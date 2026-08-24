import "server-only";
import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@/lib/db";
import {
  candidateContacts,
  candidates,
  consents,
  diagnoses,
  diagnosisOccupationMatches,
  occupations,
  referrals,
  regions,
} from "@/lib/db/schema";

export interface AgentCandidateCard {
  referralId: number;
  status: string;
  referredAt: Date;
  /** Withheld until a valid consent for this agency exists. */
  contact: { fullName: string; email: string; phone: string | null } | null;
  age: number | null;
  currentRegion: string | null;
  desiredRegions: string[];
  currentOccupation: string | null;
  currentSalaryYen: number | null;
  estimatedSalaryLow: number | null;
  estimatedSalaryHigh: number | null;
  matchRank: string | null;
  recommendedOccupations: string[];
  desiredTiming: string | null;
  experienceYears: number | null;
  offerCompany: string | null;
  offerJobTitle: string | null;
  offerSalaryYen: number | null;
  offerDate: string | null;
  joinedDate: string | null;
  lostReason: string | null;
  notes: string | null;
}

/**
 * Loads a referral for the owning agency only, and only exposes contact details
 * when an un-revoked consent row for that same agency exists. The check is done
 * here rather than in the page so no agent view can bypass it.
 */
export async function loadAgentCandidate(
  db: Database,
  agentCompanyId: number,
  referralId: number,
): Promise<AgentCandidateCard | null> {
  const [row] = await db
    .select({ referral: referrals, candidate: candidates })
    .from(referrals)
    .innerJoin(candidates, eq(referrals.candidateId, candidates.id))
    .where(
      and(eq(referrals.id, referralId), eq(referrals.agentCompanyId, agentCompanyId)),
    )
    .limit(1);
  if (!row) return null;

  const [diagnosis] = await db
    .select()
    .from(diagnoses)
    .where(
      and(
        eq(diagnoses.candidateId, row.candidate.id),
        eq(diagnoses.status, "completed"),
      ),
    )
    .orderBy(desc(diagnoses.completedAt))
    .limit(1);

  const [consent] = await db
    .select({ id: consents.id })
    .from(consents)
    .where(
      and(
        eq(consents.candidateId, row.candidate.id),
        eq(consents.agentCompanyId, agentCompanyId),
      ),
    )
    .limit(1);

  let contact: AgentCandidateCard["contact"] = null;
  let age: number | null = null;
  if (consent) {
    const [contactRow] = await db
      .select()
      .from(candidateContacts)
      .where(eq(candidateContacts.candidateId, row.candidate.id))
      .limit(1);
    if (contactRow) {
      contact = {
        fullName: contactRow.fullName,
        email: contactRow.email,
        phone: contactRow.phone,
      };
      age = contactRow.birthYear
        ? new Date().getFullYear() - contactRow.birthYear
        : null;
    }
  }

  const recommended = diagnosis
    ? await db
        .select({ name: occupations.name })
        .from(diagnosisOccupationMatches)
        .innerJoin(
          occupations,
          eq(diagnosisOccupationMatches.occupationId, occupations.id),
        )
        .where(
          and(
            eq(diagnosisOccupationMatches.diagnosisId, diagnosis.id),
            eq(diagnosisOccupationMatches.isCurrent, false),
          ),
        )
        .orderBy(diagnosisOccupationMatches.rankOrder)
        .limit(3)
    : [];

  const regionRows = await db.select().from(regions);
  const regionName = (id: number | null) =>
    id === null ? null : (regionRows.find((region) => region.id === id)?.name ?? null);

  const currentOccupation = diagnosis?.currentOccupationId
    ? ((
        await db
          .select({ name: occupations.name })
          .from(occupations)
          .where(eq(occupations.id, diagnosis.currentOccupationId))
          .limit(1)
      )[0]?.name ?? null)
    : null;

  return {
    referralId: row.referral.id,
    status: row.referral.status,
    referredAt: row.referral.referredAt,
    contact,
    age,
    currentRegion: regionName(diagnosis?.currentRegionId ?? null),
    desiredRegions: (diagnosis?.desiredRegionIds ?? [])
      .map((id) => regionName(id))
      .filter((name): name is string => name !== null),
    currentOccupation,
    currentSalaryYen: diagnosis?.currentSalaryYen ?? null,
    estimatedSalaryLow: diagnosis?.estimatedSalaryLow ?? null,
    estimatedSalaryHigh: diagnosis?.estimatedSalaryHigh ?? null,
    matchRank: diagnosis?.matchRank ?? null,
    recommendedOccupations: recommended.map((item) => item.name),
    desiredTiming: diagnosis?.desiredTiming ?? null,
    experienceYears: diagnosis?.experienceYears ?? null,
    offerCompany: row.referral.offerCompany,
    offerJobTitle: row.referral.offerJobTitle,
    offerSalaryYen: row.referral.offerSalaryYen,
    offerDate: row.referral.offerDate,
    joinedDate: row.referral.joinedDate,
    lostReason: row.referral.lostReason,
    notes: row.referral.notes,
  };
}
