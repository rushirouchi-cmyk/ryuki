import { and, count, desc, eq, inArray, isNotNull, lte, or, sql } from "drizzle-orm";
import type { Database } from "@/lib/db";
import {
  agentCompanies,
  agentFeeRules,
  agentRecommendations,
  agentRegions,
  agentSalaryBands,
  agentSpecialties,
  candidates,
  consents,
  diagnoses,
  diagnosisOccupationMatches,
  referrals,
  revenueEvents,
} from "@/lib/db/schema";
import { getAgentMatchingConfig, getConsentConfig } from "@/lib/config/store";
import { advanceStage } from "@/lib/domain/candidates/service";
import { emitCandidateEvent } from "@/lib/domain/events/service";
import { rankAgents, type AgentProfile } from "./matching";

export interface RecommendationView {
  agentCompanyId: number;
  name: string;
  score: number;
  rankOrder: number;
  reasons: string[];
}

async function loadAgentProfiles(db: Database): Promise<AgentProfile[]> {
  const [companies, specialties, regions, bands, performance] = await Promise.all([
    db.select().from(agentCompanies).where(eq(agentCompanies.active, true)),
    db.select().from(agentSpecialties),
    db.select().from(agentRegions),
    db.select().from(agentSalaryBands),
    db
      .select({
        agentCompanyId: referrals.agentCompanyId,
        referralCount: count(),
        joinedCount: sql<number>`count(*) filter (where ${referrals.joinedAt} is not null)::int`,
      })
      .from(referrals)
      .groupBy(referrals.agentCompanyId),
  ]);

  const bandMap = new Map(bands.map((row) => [row.agentCompanyId, row]));
  const performanceMap = new Map(performance.map((row) => [row.agentCompanyId, row]));

  return companies.map((company) => {
    const band = bandMap.get(company.id);
    const stats = performanceMap.get(company.id);
    return {
      agentCompanyId: company.id,
      name: company.name,
      specialties: new Map(
        specialties
          .filter((row) => row.agentCompanyId === company.id)
          .map((row) => [row.occupationId, row.strength]),
      ),
      regionIds: new Set(
        regions
          .filter((row) => row.agentCompanyId === company.id)
          .map((row) => row.regionId),
      ),
      minSalaryYen: band?.minSalaryYen ?? 0,
      maxSalaryYen: band?.maxSalaryYen ?? 30_000_000,
      referralCount: stats?.referralCount ?? 0,
      joinedCount: stats?.joinedCount ?? 0,
    };
  });
}

/**
 * Computes and stores the shortlist. Nothing is sent anywhere: the candidate
 * still has to pick an agency and consent before any PII moves.
 */
export async function buildRecommendations(
  db: Database,
  candidateId: string,
  at: Date = new Date(),
): Promise<RecommendationView[]> {
  const [diagnosis] = await db
    .select()
    .from(diagnoses)
    .where(and(eq(diagnoses.candidateId, candidateId), eq(diagnoses.status, "completed")))
    .orderBy(desc(diagnoses.completedAt))
    .limit(1);

  if (!diagnosis?.currentOccupationId) return [];

  const targets = await db
    .select({ occupationId: diagnosisOccupationMatches.occupationId })
    .from(diagnosisOccupationMatches)
    .where(
      and(
        eq(diagnosisOccupationMatches.diagnosisId, diagnosis.id),
        eq(diagnosisOccupationMatches.isCurrent, false),
        lte(diagnosisOccupationMatches.rankOrder, 900),
      ),
    )
    .orderBy(diagnosisOccupationMatches.rankOrder);

  const [config, agents] = await Promise.all([
    getAgentMatchingConfig(db),
    loadAgentProfiles(db),
  ]);

  const ranked = rankAgents(
    agents,
    {
      targetOccupationIds: targets.map((row) => row.occupationId),
      currentOccupationId: diagnosis.currentOccupationId,
      desiredRegionIds: diagnosis.desiredRegionIds,
      currentRegionId: diagnosis.currentRegionId ?? 0,
      estimatedSalaryYen:
        diagnosis.estimatedSalaryHigh !== null && diagnosis.estimatedSalaryLow !== null
          ? Math.round(
              (diagnosis.estimatedSalaryHigh + diagnosis.estimatedSalaryLow) / 2,
            )
          : null,
      experienceYears: diagnosis.experienceYears ?? 0,
      managementYears: diagnosis.managementYears,
    },
    config,
  );

  const nameMap = new Map(agents.map((agent) => [agent.agentCompanyId, agent.name]));

  for (const [index, match] of ranked.entries()) {
    await db
      .insert(agentRecommendations)
      .values({
        candidateId,
        agentCompanyId: match.agentCompanyId,
        score: match.score,
        rankOrder: index + 1,
        reasons: match.reasons,
        createdAt: at,
      })
      .onConflictDoUpdate({
        target: [agentRecommendations.candidateId, agentRecommendations.agentCompanyId],
        set: { score: match.score, rankOrder: index + 1, reasons: match.reasons },
      });
  }

  if (ranked.length > 0) {
    await emitCandidateEvent(db, {
      candidateId,
      eventType: "agent_recommended",
      occurredAt: at,
      metadata: { agentCompanyIds: ranked.map((match) => match.agentCompanyId) },
    });
  }

  return ranked.map((match, index) => ({
    agentCompanyId: match.agentCompanyId,
    name: nameMap.get(match.agentCompanyId) ?? "",
    score: match.score,
    rankOrder: index + 1,
    reasons: match.reasons,
  }));
}

export async function listRecommendations(
  db: Database,
  candidateId: string,
): Promise<RecommendationView[]> {
  const rows = await db
    .select({
      agentCompanyId: agentRecommendations.agentCompanyId,
      score: agentRecommendations.score,
      rankOrder: agentRecommendations.rankOrder,
      reasons: agentRecommendations.reasons,
      name: agentCompanies.name,
    })
    .from(agentRecommendations)
    .innerJoin(agentCompanies, eq(agentRecommendations.agentCompanyId, agentCompanies.id))
    .where(eq(agentRecommendations.candidateId, candidateId))
    .orderBy(agentRecommendations.rankOrder);

  return rows.map((row) => ({
    agentCompanyId: row.agentCompanyId,
    name: row.name,
    score: row.score,
    rankOrder: row.rankOrder,
    reasons: row.reasons,
  }));
}

/**
 * Records explicit third-party disclosure consent and creates the referral.
 * A referral can only exist with a consent row pointing at the same agency —
 * enforced by the not-null FK on `referrals.consent_id`.
 */
export async function referCandidate(
  db: Database,
  candidateId: string,
  agentCompanyIds: number[],
  at: Date = new Date(),
): Promise<number[]> {
  if (agentCompanyIds.length === 0) return [];

  const consentConfig = await getConsentConfig(db);
  const created: number[] = [];

  for (const agentCompanyId of agentCompanyIds) {
    const [existing] = await db
      .select({ id: referrals.id })
      .from(referrals)
      .where(
        and(
          eq(referrals.candidateId, candidateId),
          eq(referrals.agentCompanyId, agentCompanyId),
        ),
      )
      .limit(1);
    if (existing) continue;

    const [consent] = await db
      .insert(consents)
      .values({
        candidateId,
        agentCompanyId,
        scope: consentConfig.scope,
        contentVersion: consentConfig.version,
        consentText: consentConfig.text,
        consentedAt: at,
      })
      .returning({ id: consents.id });
    if (!consent) throw new Error("failed to record consent");

    const [referral] = await db
      .insert(referrals)
      .values({
        candidateId,
        agentCompanyId,
        consentId: consent.id,
        status: "pending",
        referredAt: at,
        createdAt: at,
        updatedAt: at,
      })
      .returning({ id: referrals.id });
    if (!referral) throw new Error("failed to create referral");

    created.push(referral.id);
  }

  if (created.length > 0) {
    await emitCandidateEvent(db, {
      candidateId,
      eventType: "consent_given",
      occurredAt: at,
      metadata: { agentCompanyIds, contentVersion: consentConfig.version },
    });
    await advanceStage(db, candidateId, "referred");
    await emitCandidateEvent(db, {
      candidateId,
      eventType: "agent_referred",
      occurredAt: at,
      metadata: { agentCompanyIds },
    });
  }

  return created;
}

export async function hasConsent(
  db: Database,
  candidateId: string,
  agentCompanyId: number,
): Promise<boolean> {
  const [row] = await db
    .select({ id: consents.id })
    .from(consents)
    .where(
      and(
        eq(consents.candidateId, candidateId),
        eq(consents.agentCompanyId, agentCompanyId),
        sql`${consents.revokedAt} is null`,
      ),
    )
    .limit(1);
  return Boolean(row);
}

/* -------------------------------------------------------------------------- */
/* Referral status & outcomes                                                 */
/* -------------------------------------------------------------------------- */

export const REFERRAL_STATUS_FLOW = [
  "pending",
  "accepted",
  "declined",
  "contacted",
  "interview_scheduled",
  "interview_completed",
  "applied",
  "offer",
  "joined",
  "lost",
] as const;

export type ReferralStatus = (typeof REFERRAL_STATUS_FLOW)[number];

const STATUS_TIMESTAMP: Partial<Record<ReferralStatus, keyof typeof referrals.$inferInsert>> =
  {
    accepted: "acceptedAt",
    declined: "declinedAt",
    contacted: "contactedAt",
    interview_scheduled: "interviewScheduledAt",
    interview_completed: "interviewCompletedAt",
    applied: "appliedAt",
    offer: "offerAt",
    joined: "joinedAt",
    lost: "lostAt",
  };

const STATUS_EVENT: Partial<Record<ReferralStatus, string>> = {
  accepted: "agent_accepted",
  declined: "agent_declined",
  interview_completed: "agent_interview_completed",
  applied: "applied",
  offer: "offer_received",
  joined: "joined",
  lost: "lost",
};

export interface OutcomeInput {
  offerCompany?: string | null;
  offerJobTitle?: string | null;
  offerSalaryYen?: number | null;
  offerDate?: string | null;
  joinedDate?: string | null;
  lostReason?: string | null;
  notes?: string | null;
}

export async function updateReferralStatus(
  db: Database,
  referralId: number,
  status: ReferralStatus,
  actorUserId: string | null,
  outcome: OutcomeInput = {},
  at: Date = new Date(),
): Promise<void> {
  const [referral] = await db
    .select()
    .from(referrals)
    .where(eq(referrals.id, referralId))
    .limit(1);
  if (!referral) throw new Error(`unknown referral: ${referralId}`);

  const now = at;
  const timestampColumn = STATUS_TIMESTAMP[status];
  const patch: Record<string, unknown> = { status, updatedAt: now };
  if (timestampColumn) patch[timestampColumn] = now;

  if (outcome.offerCompany !== undefined) patch.offerCompany = outcome.offerCompany;
  if (outcome.offerJobTitle !== undefined) patch.offerJobTitle = outcome.offerJobTitle;
  if (outcome.offerSalaryYen !== undefined) patch.offerSalaryYen = outcome.offerSalaryYen;
  if (outcome.offerDate !== undefined) patch.offerDate = outcome.offerDate;
  if (outcome.joinedDate !== undefined) patch.joinedDate = outcome.joinedDate;
  if (outcome.lostReason !== undefined) patch.lostReason = outcome.lostReason;
  if (outcome.notes !== undefined) patch.notes = outcome.notes;

  await db.update(referrals).set(patch).where(eq(referrals.id, referralId));

  const eventType = STATUS_EVENT[status];
  if (eventType && referral.status !== status) {
    await emitCandidateEvent(db, {
      candidateId: referral.candidateId,
      eventType: eventType as never,
      userId: actorUserId,
      occurredAt: at,
      metadata: { referralId, agentCompanyId: referral.agentCompanyId },
    });
  }

  if (status === "joined" || status === "offer") {
    await advanceStage(db, referral.candidateId, "outcome");
  }

  await syncRevenueForReferral(db, referralId);
}

/* -------------------------------------------------------------------------- */
/* Revenue                                                                    */
/* -------------------------------------------------------------------------- */

const REVENUE_TRIGGER: {
  eventType: "agent_accepted" | "agent_interview_completed" | "offer" | "joined";
  reached: (referral: typeof referrals.$inferSelect) => Date | null;
}[] = [
  { eventType: "agent_accepted", reached: (r) => r.acceptedAt },
  { eventType: "agent_interview_completed", reached: (r) => r.interviewCompletedAt },
  { eventType: "offer", reached: (r) => r.offerAt },
  { eventType: "joined", reached: (r) => r.joinedAt },
];

/**
 * Materialises fee-schedule revenue as the referral progresses. Rows start as
 * `estimated`; an admin confirms them once the agency actually pays, which is
 * what separates pipeline value from booked revenue on the dashboard.
 */
export async function syncRevenueForReferral(
  db: Database,
  referralId: number,
): Promise<void> {
  const [referral] = await db
    .select()
    .from(referrals)
    .where(eq(referrals.id, referralId))
    .limit(1);
  if (!referral) return;

  const rules = await db
    .select()
    .from(agentFeeRules)
    .where(
      and(
        eq(agentFeeRules.agentCompanyId, referral.agentCompanyId),
        eq(agentFeeRules.active, true),
      ),
    );

  for (const trigger of REVENUE_TRIGGER) {
    const occurredAt = trigger.reached(referral);
    if (!occurredAt) continue;

    const rule = rules.find((candidateRule) => candidateRule.eventType === trigger.eventType);
    if (!rule) continue;

    await db
      .insert(revenueEvents)
      .values({
        referralId,
        candidateId: referral.candidateId,
        agentCompanyId: referral.agentCompanyId,
        eventType: trigger.eventType,
        amountYen: rule.amountYen,
        status: "estimated",
        occurredAt,
        feeRuleId: rule.id,
      })
      .onConflictDoNothing({
        target: [revenueEvents.referralId, revenueEvents.eventType],
      });
  }

  if (referral.status === "declined" || referral.status === "lost") {
    await db
      .update(revenueEvents)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(revenueEvents.referralId, referralId),
          eq(revenueEvents.status, "estimated"),
          or(
            eq(revenueEvents.eventType, "offer"),
            eq(revenueEvents.eventType, "joined"),
          ),
        ),
      );
  }
}

export async function listAgentCandidates(db: Database, agentCompanyId: number) {
  return db
    .select({
      referral: referrals,
      candidate: candidates,
      diagnosis: diagnoses,
    })
    .from(referrals)
    .innerJoin(candidates, eq(referrals.candidateId, candidates.id))
    .leftJoin(
      diagnoses,
      and(eq(diagnoses.candidateId, candidates.id), eq(diagnoses.status, "completed")),
    )
    .where(eq(referrals.agentCompanyId, agentCompanyId))
    .orderBy(desc(referrals.referredAt));
}

export async function getAgentReferral(
  db: Database,
  agentCompanyId: number,
  referralId: number,
) {
  const [row] = await db
    .select()
    .from(referrals)
    .where(
      and(eq(referrals.id, referralId), eq(referrals.agentCompanyId, agentCompanyId)),
    )
    .limit(1);
  return row ?? null;
}

export async function confirmRevenue(
  db: Database,
  revenueEventIds: number[],
): Promise<void> {
  if (revenueEventIds.length === 0) return;
  await db
    .update(revenueEvents)
    .set({ status: "confirmed", confirmedAt: new Date() })
    .where(
      and(
        inArray(revenueEvents.id, revenueEventIds),
        isNotNull(revenueEvents.occurredAt),
      ),
    );
}
