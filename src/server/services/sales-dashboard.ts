import 'server-only';
import { and, eq, gte, lt } from 'drizzle-orm';
import { getDb, schema } from '@/db/client';
import { countFunnel } from '@/domain/analytics/funnel';
import { sumEarnedAmount } from '@/domain/incentive/engine';
import { getIncentiveConfig } from '@/server/settings';
import { getActiveShift, getSalesEventsSince, shiftHours } from './shifts';

export interface SalesDashboard {
  today: {
    approaches: number;
    stops: number;
    scans: number;
    diagnosisCompleted: number;
    leads: number;
    interviewBooked: number;
    interviewCompleted: number;
    qualified: number;
    referrals: number;
    salesHours: number;
  };
  todayIncentive: number;
  monthIncentive: number;
  pendingIncentive: number;
  bonus: { label: string; remaining: number; bonusAmount: number } | null;
  activeShift: Awaited<ReturnType<typeof getActiveShift>>;
}

function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfMonth(): Date {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function loadSalesDashboard(salesUserId: string): Promise<SalesDashboard> {
  const db = getDb();
  const dayStart = startOfToday();
  const monthStart = startOfMonth();
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);

  const [events, todayShifts, ledger, config, activeShift] = await Promise.all([
    getSalesEventsSince(salesUserId, dayStart),
    db.query.shifts.findMany({
      where: and(
        eq(schema.shifts.salesUserId, salesUserId),
        gte(schema.shifts.startTime, dayStart),
        lt(schema.shifts.startTime, dayEnd),
      ),
    }),
    db.query.incentiveLedger.findMany({
      where: and(
        eq(schema.incentiveLedger.salesUserId, salesUserId),
        gte(schema.incentiveLedger.occurredAt, monthStart),
      ),
    }),
    getIncentiveConfig(),
    getActiveShift(salesUserId),
  ]);

  const funnel = countFunnel(events);
  const todayLedger = ledger.filter((entry) => entry.occurredAt >= dayStart);

  const monthEventCount = ledger.filter(
    (entry) => entry.eventType === config.monthlyBonus.eventType && entry.status !== 'rejected',
  ).length;

  return {
    today: {
      approaches: todayShifts.reduce((sum, s) => sum + s.approachCount, 0),
      stops: todayShifts.reduce((sum, s) => sum + s.stoppedCount, 0),
      scans: funnel.qr_scanned,
      diagnosisCompleted: funnel.diagnosis_completed,
      leads: funnel.lead_registered,
      interviewBooked: funnel.interview_booked,
      interviewCompleted: funnel.interview_completed,
      qualified: funnel.candidate_qualified,
      referrals: funnel.agent_referred,
      salesHours: todayShifts.reduce((sum, s) => sum + shiftHours(s), 0),
    },
    todayIncentive: sumEarnedAmount(todayLedger),
    monthIncentive: sumEarnedAmount(ledger),
    pendingIncentive: ledger.filter((e) => e.status === 'pending').reduce((sum, e) => sum + e.amount, 0),
    bonus:
      monthEventCount < config.monthlyBonus.targetCount
        ? {
            label: config.monthlyBonus.eventType,
            remaining: config.monthlyBonus.targetCount - monthEventCount,
            bonusAmount: config.monthlyBonus.bonusAmount,
          }
        : null,
    activeShift,
  };
}
