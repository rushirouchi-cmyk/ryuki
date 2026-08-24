import 'server-only';
import { desc, eq, sql } from 'drizzle-orm';
import { getDb, schema } from '@/db/client';
import type { DiagnosisResult } from '@/domain/diagnosis/types';

export interface CandidateListFilters {
  status?: string;
  salesUserId?: string;
  locationId?: string;
  qualifiedOnly?: boolean;
  limit?: number;
}

export interface CandidateListRow {
  id: string;
  status: string;
  createdAt: Date;
  ageBand: string | null;
  prefecture: string | null;
  qualified: boolean;
  valueRank: string | null;
  estimatedSalaryLow: number | null;
  estimatedSalaryHigh: number | null;
  salesUserName: string | null;
  venueName: string | null;
  hasPii: boolean;
}

export async function listCandidates(filters: CandidateListFilters): Promise<CandidateListRow[]> {
  const db = getDb();
  const conditions = [sql`true`];
  if (filters.status) conditions.push(sql`${schema.candidates.status}::text = ${filters.status}`);
  if (filters.salesUserId) conditions.push(sql`${schema.candidateAttributions.salesUserId} = ${filters.salesUserId}`);
  if (filters.locationId) conditions.push(sql`${schema.candidateAttributions.locationId} = ${filters.locationId}`);
  if (filters.qualifiedOnly) conditions.push(sql`${schema.candidates.qualified} = true`);

  const rows = await db
    .select({
      id: schema.candidates.id,
      status: schema.candidates.status,
      createdAt: schema.candidates.createdAt,
      ageBand: schema.candidates.ageBand,
      prefecture: schema.candidates.prefecture,
      qualified: schema.candidates.qualified,
      email: schema.candidates.email,
      valueRank: schema.diagnoses.valueRank,
      estimatedSalaryLow: schema.diagnoses.estimatedSalaryLow,
      estimatedSalaryHigh: schema.diagnoses.estimatedSalaryHigh,
      salesUserName: schema.users.displayName,
      venueName: schema.locations.venueName,
    })
    .from(schema.candidates)
    .leftJoin(
      schema.candidateAttributions,
      eq(schema.candidateAttributions.candidateId, schema.candidates.id),
    )
    .leftJoin(schema.users, eq(schema.users.id, schema.candidateAttributions.salesUserId))
    .leftJoin(schema.locations, eq(schema.locations.id, schema.candidateAttributions.locationId))
    .leftJoin(schema.diagnoses, eq(schema.diagnoses.candidateId, schema.candidates.id))
    .where(sql.join(conditions, sql` and `))
    .orderBy(desc(schema.candidates.createdAt))
    .limit(filters.limit ?? 100);

  return rows.map(({ email, ...row }) => ({ ...row, hasPii: Boolean(email) }));
}

export async function getCandidateJourney(candidateId: string) {
  const db = getDb();
  const [candidate, attribution, diagnosis, events, interviews, referrals, incentives, revenue, consents] =
    await Promise.all([
      db.query.candidates.findFirst({ where: eq(schema.candidates.id, candidateId) }),
      db.query.candidateAttributions.findFirst({
        where: eq(schema.candidateAttributions.candidateId, candidateId),
        with: { salesUser: true, location: true, shift: true },
      }),
      db.query.diagnoses.findFirst({
        where: eq(schema.diagnoses.candidateId, candidateId),
        orderBy: [desc(schema.diagnoses.completedAt)],
      }),
      db.query.candidateEvents.findMany({
        where: eq(schema.candidateEvents.candidateId, candidateId),
        orderBy: [schema.candidateEvents.createdAt],
      }),
      db.query.interviews.findMany({ where: eq(schema.interviews.candidateId, candidateId) }),
      db.query.referrals.findMany({
        where: eq(schema.referrals.candidateId, candidateId),
        with: { agentCompany: true },
      }),
      db.query.incentiveLedger.findMany({ where: eq(schema.incentiveLedger.candidateId, candidateId) }),
      db.query.revenueEvents.findMany({ where: eq(schema.revenueEvents.candidateId, candidateId) }),
      db.query.consents.findMany({ where: eq(schema.consents.candidateId, candidateId) }),
    ]);

  if (!candidate) return null;

  return {
    candidate,
    attribution,
    diagnosis,
    diagnosisResult: diagnosis?.result as unknown as DiagnosisResult | undefined,
    events,
    interviews,
    referrals,
    incentives,
    revenue,
    consents,
  };
}
