import 'server-only';
import { and, eq, isNull, or } from 'drizzle-orm';
import { getDb, schema } from '@/db/client';
import { recommendAgents, type AgentPerformance } from '@/domain/agent-routing';
import { getAgentRoutingConfig } from '@/server/settings';
import { consentText, CONSENT_TEXT_VERSION } from './referral-consent-text';
import { recordCandidateEvent } from './events';
import { getLatestDiagnosis } from './diagnosis';

type ReferralStatus = (typeof schema.referralStatusEnum.enumValues)[number];

export { CONSENT_TEXT_VERSION, consentText } from './referral-consent-text';

/** Builds and stores the candidate's agent shortlist. Nothing is sent yet. */
export async function buildRecommendations(candidateId: string) {
  const db = getDb();
  const [diagnosis, agents, config] = await Promise.all([
    getLatestDiagnosis(candidateId),
    db.query.agentCompanies.findMany({ where: eq(schema.agentCompanies.active, true) }),
    getAgentRoutingConfig(),
  ]);
  if (!diagnosis) throw new Error('診断結果が存在しません。');

  const candidate = await db.query.candidates.findFirst({ where: eq(schema.candidates.id, candidateId) });
  const matches = await db.query.diagnosisOccupationMatches.findMany({
    where: eq(schema.diagnosisOccupationMatches.diagnosisId, diagnosis.id),
  });

  const allReferrals = await db.query.referrals.findMany();
  const performance: AgentPerformance[] = agents.map((agent) => {
    const mine = allReferrals.filter((r) => r.agentCompanyId === agent.id);
    return {
      agentCompanyId: agent.id,
      referrals: mine.length,
      joined: mine.filter((r) => r.status === 'joined').length,
    };
  });

  const answers = diagnosis.input as { experienceYears?: number; hasManagementExperience?: boolean };

  const recommendations = recommendAgents(
    {
      topOccupationIds: matches
        .sort((a, b) => a.rankPosition - b.rankPosition)
        .slice(0, 3)
        .map((m) => m.occupationId),
      regionId: diagnosis.regionId,
      desiredPrefectures: candidate?.desiredPrefectures ?? [],
      estimatedSalaryHigh: diagnosis.estimatedSalaryHigh ?? 0,
      experienceYears: answers.experienceYears ?? 0,
      hasManagementExperience: answers.hasManagementExperience ?? false,
    },
    agents.map((a) => ({
      id: a.id,
      name: a.name,
      specialtyOccupationIds: a.specialtyOccupationIds,
      coverageRegionIds: a.coverageRegionIds,
      minSalaryFocus: a.minSalaryFocus,
      maxSalaryFocus: a.maxSalaryFocus,
      active: a.active,
    })),
    performance,
    config,
  );

  for (const reco of recommendations) {
    await db
      .insert(schema.agentRecommendations)
      .values({
        candidateId,
        agentCompanyId: reco.agentCompanyId,
        score: reco.score,
        breakdown: reco.breakdown,
        rankPosition: reco.rankPosition,
      })
      .onConflictDoUpdate({
        target: [schema.agentRecommendations.candidateId, schema.agentRecommendations.agentCompanyId],
        set: { score: reco.score, breakdown: reco.breakdown, rankPosition: reco.rankPosition },
      });
  }

  await recordCandidateEvent({
    candidateId,
    eventType: 'agent_recommended',
    metadata: { count: recommendations.length },
  });

  return recommendations;
}

/**
 * Records explicit third-party-provision consent and then creates the referral.
 * A referral can never exist without a consent row — the FK enforces it.
 */
export async function consentAndRefer(params: {
  candidateId: string;
  agentCompanyId: string;
}): Promise<string> {
  const db = getDb();
  const agent = await db.query.agentCompanies.findFirst({
    where: eq(schema.agentCompanies.id, params.agentCompanyId),
  });
  if (!agent) throw new Error('エージェントが見つかりません。');

  const text = consentText(agent.name);
  const insertedConsent = await db
    .insert(schema.consents)
    .values({
      candidateId: params.candidateId,
      agentCompanyId: params.agentCompanyId,
      consentText: text,
      consentVersion: CONSENT_TEXT_VERSION,
    })
    .onConflictDoUpdate({
      target: [schema.consents.candidateId, schema.consents.agentCompanyId, schema.consents.consentType],
      set: { grantedAt: new Date(), revokedAt: null, consentText: text },
    })
    .returning();

  const consent = insertedConsent[0];
  if (!consent) throw new Error('同意の保存に失敗しました。');

  await recordCandidateEvent({
    candidateId: params.candidateId,
    eventType: 'consent_given',
    agentCompanyId: params.agentCompanyId,
    metadata: { consentVersion: CONSENT_TEXT_VERSION },
  });

  const insertedReferral = await db
    .insert(schema.referrals)
    .values({
      candidateId: params.candidateId,
      agentCompanyId: params.agentCompanyId,
      consentId: consent.id,
      status: 'referred',
    })
    .onConflictDoNothing()
    .returning();

  const referral =
    insertedReferral[0] ??
    (await db.query.referrals.findFirst({
      where: and(
        eq(schema.referrals.candidateId, params.candidateId),
        eq(schema.referrals.agentCompanyId, params.agentCompanyId),
      ),
    }));
  if (!referral) throw new Error('送客の作成に失敗しました。');

  await db
    .update(schema.candidates)
    .set({ status: 'referred', updatedAt: new Date() })
    .where(eq(schema.candidates.id, params.candidateId));

  await recordCandidateEvent({
    candidateId: params.candidateId,
    eventType: 'agent_referred',
    agentCompanyId: params.agentCompanyId,
    metadata: { referralId: referral.id },
  });

  await recognizeRevenue({ referralId: referral.id, eventType: 'agent_referred' });

  return referral.id;
}

const STATUS_TIMESTAMP: Partial<Record<ReferralStatus, keyof typeof schema.referrals.$inferInsert>> = {
  accepted: 'acceptedAt',
  declined: 'declinedAt',
  contacted: 'contactedAt',
  interview_scheduled: 'interviewScheduledAt',
  interview_completed: 'interviewCompletedAt',
  application: 'appliedAt',
  offer: 'offerAt',
  joined: 'joinedAt',
  lost: 'lostAt',
};

const STATUS_EVENT: Partial<
  Record<ReferralStatus, (typeof schema.candidateEventTypeEnum.enumValues)[number]>
> = {
  accepted: 'agent_accepted',
  declined: 'agent_declined',
  interview_completed: 'agent_interview_completed',
  application: 'applied',
  offer: 'offer_received',
  joined: 'joined',
  lost: 'lost',
};

const STATUS_REVENUE: Partial<Record<ReferralStatus, (typeof schema.monetizableEventEnum.enumValues)[number]>> = {
  accepted: 'agent_accepted',
  interview_completed: 'agent_interview_completed',
  offer: 'offer',
  joined: 'joined',
};

export async function updateReferralStatus(params: {
  referralId: string;
  status: ReferralStatus;
  outcome?: {
    offerCompanyName?: string | null;
    offerJobTitle?: string | null;
    offerSalary?: number | null;
    offerDate?: string | null;
    joinedDate?: string | null;
    lostReason?: string | null;
    notes?: string | null;
  };
}): Promise<void> {
  const db = getDb();
  const referral = await db.query.referrals.findFirst({
    where: eq(schema.referrals.id, params.referralId),
  });
  if (!referral) throw new Error('送客が見つかりません。');

  const timestampField = STATUS_TIMESTAMP[params.status];
  const patch: Record<string, unknown> = { status: params.status };
  if (timestampField) patch[timestampField] = new Date();
  if (params.outcome) {
    for (const [key, value] of Object.entries(params.outcome)) {
      if (value !== undefined && value !== null && value !== '') patch[key] = value;
    }
  }

  await db.update(schema.referrals).set(patch).where(eq(schema.referrals.id, params.referralId));

  const eventType = STATUS_EVENT[params.status];
  if (eventType) {
    await recordCandidateEvent({
      candidateId: referral.candidateId,
      eventType,
      agentCompanyId: referral.agentCompanyId,
      metadata: { referralId: referral.id, status: params.status },
    });
  }

  if (params.status === 'joined') {
    await db
      .update(schema.candidates)
      .set({ status: 'joined', updatedAt: new Date() })
      .where(eq(schema.candidates.id, referral.candidateId));
  }

  const revenueEvent = STATUS_REVENUE[params.status];
  if (revenueEvent) {
    await recognizeRevenue({ referralId: referral.id, eventType: revenueEvent });
  }
}

/**
 * Turns an agent milestone into money using that agent's fee rules.
 * `offer` / `joined` fees may be a percentage of the offer salary.
 */
export async function recognizeRevenue(params: {
  referralId: string;
  eventType: (typeof schema.monetizableEventEnum.enumValues)[number];
}): Promise<void> {
  const db = getDb();
  const referral = await db.query.referrals.findFirst({
    where: eq(schema.referrals.id, params.referralId),
  });
  if (!referral) return;

  const now = new Date();
  const rules = await db.query.agentFeeRules.findMany({
    where: and(
      eq(schema.agentFeeRules.agentCompanyId, referral.agentCompanyId),
      eq(schema.agentFeeRules.eventType, params.eventType),
      eq(schema.agentFeeRules.active, true),
      or(isNull(schema.agentFeeRules.validTo), eq(schema.agentFeeRules.active, true)),
    ),
  });
  const rule = rules.find((r) => r.validFrom <= now && (!r.validTo || r.validTo > now));
  if (!rule) return;

  const percent = rule.percentOfOfferSalary ? Number(rule.percentOfOfferSalary) : null;
  const amount =
    percent && referral.offerSalary
      ? Math.round((referral.offerSalary * percent) / 100)
      : rule.amount;
  if (amount <= 0) return;

  const confirmed = params.eventType === 'joined';
  await db
    .insert(schema.revenueEvents)
    .values({
      candidateId: referral.candidateId,
      agentCompanyId: referral.agentCompanyId,
      referralId: referral.id,
      feeRuleId: rule.id,
      eventType: params.eventType,
      amount,
      status: confirmed ? 'confirmed' : 'estimated',
      confirmedAt: confirmed ? now : null,
    })
    .onConflictDoNothing();
}
