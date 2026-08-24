import 'server-only';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { getDb, schema } from '@/db/client';
import { canViewCandidatePii, type Principal } from '@/domain/auth/rbac';
import { maskEmail, maskName, maskPhone } from '@/domain/auth/pii';
import type { DiagnosisResult } from '@/domain/diagnosis/types';

export interface AgentCandidateCard {
  referralId: string;
  candidateId: string;
  status: string;
  referredAt: Date;
  /** PII is masked unless a live consent for this agent exists */
  piiVisible: boolean;
  fullName: string;
  email: string;
  phone: string;
  ageBand: string | null;
  prefecture: string | null;
  desiredPrefectures: string[];
  jobChangeTiming: string | null;
  currentSalary: number | null;
  estimatedSalaryLow: number | null;
  estimatedSalaryHigh: number | null;
  valueRank: string | null;
  recommendedOccupations: string[];
  offerSalary: number | null;
  joinedDate: string | null;
}

async function toCard(
  principal: Principal,
  referral: typeof schema.referrals.$inferSelect,
): Promise<AgentCandidateCard> {
  const db = getDb();
  const [candidate, consent, diagnosis] = await Promise.all([
    db.query.candidates.findFirst({ where: eq(schema.candidates.id, referral.candidateId) }),
    db.query.consents.findFirst({
      where: and(
        eq(schema.consents.candidateId, referral.candidateId),
        eq(schema.consents.agentCompanyId, referral.agentCompanyId),
        isNull(schema.consents.revokedAt),
      ),
    }),
    db.query.diagnoses.findFirst({
      where: eq(schema.diagnoses.candidateId, referral.candidateId),
      orderBy: [desc(schema.diagnoses.completedAt)],
    }),
  ]);

  const piiVisible = canViewCandidatePii(principal, {
    candidateAgentCompanyId: referral.agentCompanyId,
    consent: consent ? { agentCompanyId: consent.agentCompanyId, revokedAt: consent.revokedAt } : null,
  });

  const result = diagnosis?.result as unknown as DiagnosisResult | undefined;

  return {
    referralId: referral.id,
    candidateId: referral.candidateId,
    status: referral.status,
    referredAt: referral.referredAt,
    piiVisible,
    fullName: piiVisible ? (candidate?.fullName ?? '—') : maskName(candidate?.fullName),
    email: piiVisible ? (candidate?.email ?? '—') : maskEmail(candidate?.email),
    phone: piiVisible ? (candidate?.phone ?? '—') : maskPhone(candidate?.phone),
    ageBand: candidate?.ageBand ?? null,
    prefecture: candidate?.prefecture ?? null,
    desiredPrefectures: candidate?.desiredPrefectures ?? [],
    jobChangeTiming: candidate?.jobChangeTiming ?? null,
    currentSalary: diagnosis?.currentSalary ?? null,
    estimatedSalaryLow: diagnosis?.estimatedSalaryLow ?? null,
    estimatedSalaryHigh: diagnosis?.estimatedSalaryHigh ?? null,
    valueRank: diagnosis?.valueRank ?? null,
    recommendedOccupations: (result?.options ?? []).slice(0, 3).map((option) => option.occupationName),
    offerSalary: referral.offerSalary,
    joinedDate: referral.joinedDate,
  };
}

/** Only ever returns referrals belonging to the caller's own agent company. */
export async function listAgentCandidates(principal: Principal): Promise<AgentCandidateCard[]> {
  if (!principal.agentCompanyId) return [];
  const referrals = await getDb().query.referrals.findMany({
    where: eq(schema.referrals.agentCompanyId, principal.agentCompanyId),
    orderBy: [desc(schema.referrals.referredAt)],
  });
  return Promise.all(referrals.map((referral) => toCard(principal, referral)));
}

export async function getAgentCandidate(
  principal: Principal,
  referralId: string,
): Promise<AgentCandidateCard | null> {
  const referral = await getDb().query.referrals.findFirst({
    where: eq(schema.referrals.id, referralId),
  });
  if (!referral) return null;
  if (principal.role === 'agent' && referral.agentCompanyId !== principal.agentCompanyId) return null;
  return toCard(principal, referral);
}
