import { and, count, eq, gte, lte, sql } from "drizzle-orm";
import type { Database } from "@/lib/db";
import {
  agentCompanies,
  occupations,
  referrals,
  revenueEvents,
} from "@/lib/db/schema";
import { latestDiagnosisFor } from "@/lib/domain/diagnosis/latest";
import { safeDivide } from "@/lib/utils/format";

export interface AgentPerformanceRow {
  agentCompanyId: number;
  name: string;
  referrals: number;
  accepted: number;
  interviewCompleted: number;
  applied: number;
  offers: number;
  joined: number;
  acceptRate: number | null;
  offerRate: number | null;
  joinRate: number | null;
  avgOfferSalaryYen: number | null;
  avgSalaryIncreaseYen: number | null;
  confirmedRevenueYen: number;
  estimatedRevenueYen: number;
}

export async function getAgentPerformance(
  db: Database,
  from: Date,
  to: Date,
): Promise<AgentPerformanceRow[]> {
  const diagnosis = latestDiagnosisFor(db);
  const rows = await db
    .select({
      agentCompanyId: agentCompanies.id,
      name: agentCompanies.name,
      referrals: count(referrals.id),
      accepted: sql<number>`count(*) filter (where ${referrals.acceptedAt} is not null)::int`,
      interviewCompleted: sql<number>`count(*) filter (where ${referrals.interviewCompletedAt} is not null)::int`,
      applied: sql<number>`count(*) filter (where ${referrals.appliedAt} is not null)::int`,
      offers: sql<number>`count(*) filter (where ${referrals.offerAt} is not null)::int`,
      joined: sql<number>`count(*) filter (where ${referrals.joinedAt} is not null)::int`,
      avgOfferSalary: sql<number | null>`avg(${referrals.offerSalaryYen})`,
      avgIncrease: sql<number | null>`avg(${referrals.offerSalaryYen} - ${diagnosis.currentSalaryYen})`,
    })
    .from(agentCompanies)
    .leftJoin(
      referrals,
      and(
        eq(referrals.agentCompanyId, agentCompanies.id),
        gte(referrals.referredAt, from),
        lte(referrals.referredAt, to),
      ),
    )
    .leftJoin(diagnosis, eq(diagnosis.candidateId, referrals.candidateId))
    .groupBy(agentCompanies.id, agentCompanies.name)
    .orderBy(agentCompanies.name);

  const revenue = await db
    .select({
      agentCompanyId: revenueEvents.agentCompanyId,
      confirmed: sql<number>`coalesce(sum(${revenueEvents.amountYen}) filter (where ${revenueEvents.status} = 'confirmed'), 0)::int`,
      estimated: sql<number>`coalesce(sum(${revenueEvents.amountYen}) filter (where ${revenueEvents.status} <> 'cancelled'), 0)::int`,
    })
    .from(revenueEvents)
    .where(and(gte(revenueEvents.occurredAt, from), lte(revenueEvents.occurredAt, to)))
    .groupBy(revenueEvents.agentCompanyId);

  const revenueMap = new Map(revenue.map((row) => [row.agentCompanyId, row]));

  return rows.map((row) => {
    const money = revenueMap.get(row.agentCompanyId);
    return {
      agentCompanyId: row.agentCompanyId,
      name: row.name,
      referrals: row.referrals,
      accepted: row.accepted,
      interviewCompleted: row.interviewCompleted,
      applied: row.applied,
      offers: row.offers,
      joined: row.joined,
      acceptRate: safeDivide(row.accepted, row.referrals),
      offerRate: safeDivide(row.offers, row.referrals),
      joinRate: safeDivide(row.joined, row.offers),
      avgOfferSalaryYen: row.avgOfferSalary === null ? null : Number(row.avgOfferSalary),
      avgSalaryIncreaseYen: row.avgIncrease === null ? null : Number(row.avgIncrease),
      confirmedRevenueYen: money?.confirmed ?? 0,
      estimatedRevenueYen: money?.estimated ?? 0,
    };
  });
}

export interface AgentOccupationRow {
  agentCompanyId: number;
  agentName: string;
  occupationName: string;
  referrals: number;
  joined: number;
  joinRate: number | null;
}

/** Placement performance per occupation, the input to future auto-routing. */
export async function getAgentOccupationPerformance(
  db: Database,
): Promise<AgentOccupationRow[]> {
  const diagnosis = latestDiagnosisFor(db);
  const rows = await db
    .select({
      agentCompanyId: agentCompanies.id,
      agentName: agentCompanies.name,
      occupationName: occupations.name,
      referrals: count(referrals.id),
      joined: sql<number>`count(*) filter (where ${referrals.joinedAt} is not null)::int`,
    })
    .from(referrals)
    .innerJoin(agentCompanies, eq(referrals.agentCompanyId, agentCompanies.id))
    .innerJoin(diagnosis, eq(diagnosis.candidateId, referrals.candidateId))
    .innerJoin(occupations, eq(diagnosis.currentOccupationId, occupations.id))
    .groupBy(agentCompanies.id, agentCompanies.name, occupations.name)
    .orderBy(agentCompanies.name, occupations.name);

  return rows.map((row) => ({
    ...row,
    joinRate: safeDivide(row.joined, row.referrals),
  }));
}
