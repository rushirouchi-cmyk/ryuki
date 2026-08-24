import 'server-only';
import { and, gte, lt } from 'drizzle-orm';
import { getDb, schema } from '@/db/client';
import { safeRate } from '@/domain/analytics/funnel';

export interface AgentPerformanceRow {
  agentCompanyId: string;
  agentName: string;
  referrals: number;
  accepted: number;
  interviewCompleted: number;
  application: number;
  offer: number;
  joined: number;
  offerRate: number;
  joinRate: number;
  avgOfferSalary: number | null;
  avgSalaryIncrease: number | null;
  revenue: number;
  confirmedRevenue: number;
}

const REACHED: Record<string, string[]> = {
  accepted: ['accepted', 'contacted', 'interview_scheduled', 'interview_completed', 'application', 'offer', 'joined'],
  interview_completed: ['interview_completed', 'application', 'offer', 'joined'],
  application: ['application', 'offer', 'joined'],
  offer: ['offer', 'joined'],
  joined: ['joined'],
};

export async function loadAgentPerformance(from: Date, to: Date): Promise<AgentPerformanceRow[]> {
  const db = getDb();
  const [agents, referrals, revenue, diagnoses] = await Promise.all([
    db.query.agentCompanies.findMany(),
    db.query.referrals.findMany({
      where: and(gte(schema.referrals.referredAt, from), lt(schema.referrals.referredAt, to)),
    }),
    db.query.revenueEvents.findMany(),
    db.query.diagnoses.findMany(),
  ]);

  const currentSalaryByCandidate = new Map(
    diagnoses.map((diagnosis) => [diagnosis.candidateId, diagnosis.currentSalary]),
  );

  return agents
    .map((agent) => {
      const mine = referrals.filter((referral) => referral.agentCompanyId === agent.id);
      const reached = (key: string) =>
        mine.filter((referral) => (REACHED[key] ?? []).includes(referral.status)).length;

      const offers = mine.filter((referral) => referral.offerSalary !== null);
      const avgOfferSalary = offers.length
        ? Math.round(offers.reduce((sum, r) => sum + (r.offerSalary ?? 0), 0) / offers.length)
        : null;

      const increases = offers
        .map((referral) => {
          const current = currentSalaryByCandidate.get(referral.candidateId);
          return current && referral.offerSalary ? referral.offerSalary - current : null;
        })
        .filter((value): value is number => value !== null);

      const referralIds = new Set(mine.map((referral) => referral.id));
      const myRevenue = revenue.filter((row) => row.referralId && referralIds.has(row.referralId));

      return {
        agentCompanyId: agent.id,
        agentName: agent.name,
        referrals: mine.length,
        accepted: reached('accepted'),
        interviewCompleted: reached('interview_completed'),
        application: reached('application'),
        offer: reached('offer'),
        joined: reached('joined'),
        offerRate: safeRate(reached('offer'), mine.length),
        joinRate: safeRate(reached('joined'), mine.length),
        avgOfferSalary,
        avgSalaryIncrease: increases.length
          ? Math.round(increases.reduce((sum, v) => sum + v, 0) / increases.length)
          : null,
        revenue: myRevenue.reduce((sum, row) => sum + row.amount, 0),
        confirmedRevenue: myRevenue
          .filter((row) => row.status === 'confirmed')
          .reduce((sum, row) => sum + row.amount, 0),
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

export interface AgentOccupationRow {
  agentName: string;
  occupationName: string;
  offers: number;
  joined: number;
  avgOfferSalary: number | null;
}

/** Offer performance per agent x offered occupation — the routing feedback loop. */
export async function loadAgentOccupationPerformance(): Promise<AgentOccupationRow[]> {
  const db = getDb();
  const [agents, occupations, referrals] = await Promise.all([
    db.query.agentCompanies.findMany(),
    db.query.occupations.findMany(),
    db.query.referrals.findMany(),
  ]);
  const agentById = new Map(agents.map((a) => [a.id, a]));
  const occupationById = new Map(occupations.map((o) => [o.id, o]));

  const grouped = new Map<string, AgentOccupationRow & { salaries: number[] }>();
  for (const referral of referrals) {
    if (!referral.offerOccupationId || !referral.offerSalary) continue;
    const key = `${referral.agentCompanyId}|${referral.offerOccupationId}`;
    const existing = grouped.get(key) ?? {
      agentName: agentById.get(referral.agentCompanyId)?.name ?? '—',
      occupationName: occupationById.get(referral.offerOccupationId)?.name ?? '—',
      offers: 0,
      joined: 0,
      avgOfferSalary: null,
      salaries: [],
    };
    existing.offers += 1;
    if (referral.status === 'joined') existing.joined += 1;
    existing.salaries.push(referral.offerSalary);
    grouped.set(key, existing);
  }

  return [...grouped.values()]
    .map(({ salaries, ...row }) => ({
      ...row,
      avgOfferSalary: salaries.length
        ? Math.round(salaries.reduce((sum, v) => sum + v, 0) / salaries.length)
        : null,
    }))
    .sort((a, b) => b.offers - a.offers);
}
