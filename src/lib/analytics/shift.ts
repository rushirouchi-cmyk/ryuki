import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { candidateEvents, incentiveLedger, revenueEvents, shifts } from "@/lib/db/schema";

/**
 * The per-shift figures the spec lists on the shift record itself. Only the two
 * manual counters live on the row; everything downstream is derived from the
 * event log so it can never drift out of sync with the funnel.
 */
export interface ShiftMetrics {
  shiftId: number;
  salesUserId: string;
  locationId: number;
  startTime: Date;
  endTime: Date | null;
  plannedEndTime: Date;
  weather: string | null;
  venueType: string;
  status: string;
  salesHours: number;
  approachCount: number;
  stoppedCount: number;
  scanCount: number;
  diagnosisStarted: number;
  diagnosisCompleted: number;
  leadRegistered: number;
  interviewBooked: number;
  interviewCompleted: number;
  qualifiedCount: number;
  referralCount: number;
  estimatedRevenueYen: number;
  confirmedRevenueYen: number;
  incentiveYen: number;
}

const EVENT_FIELDS = {
  scanCount: "qr_scanned",
  diagnosisStarted: "diagnosis_started",
  diagnosisCompleted: "diagnosis_completed",
  leadRegistered: "lead_registered",
  interviewBooked: "interview_booked",
  interviewCompleted: "interview_completed",
  qualifiedCount: "candidate_qualified",
  referralCount: "agent_referred",
} as const;

export async function getShiftMetrics(
  db: Database,
  shiftIds: number[],
): Promise<Map<number, ShiftMetrics>> {
  if (shiftIds.length === 0) return new Map();

  const shiftRows = await db
    .select()
    .from(shifts)
    .where(inArray(shifts.id, shiftIds));

  /* Distinct candidates, matching the definition used by the admin funnel. */
  const countOf = (eventType: string) =>
    sql<number>`count(distinct ${candidateEvents.candidateId}) filter (where ${candidateEvents.eventType} = ${eventType})::int`;

  const eventRows = await db
    .select({
      shiftId: candidateEvents.shiftId,
      scanCount: countOf(EVENT_FIELDS.scanCount),
      diagnosisStarted: countOf(EVENT_FIELDS.diagnosisStarted),
      diagnosisCompleted: countOf(EVENT_FIELDS.diagnosisCompleted),
      leadRegistered: countOf(EVENT_FIELDS.leadRegistered),
      interviewBooked: countOf(EVENT_FIELDS.interviewBooked),
      interviewCompleted: countOf(EVENT_FIELDS.interviewCompleted),
      qualifiedCount: countOf(EVENT_FIELDS.qualifiedCount),
      referralCount: countOf(EVENT_FIELDS.referralCount),
    })
    .from(candidateEvents)
    .where(inArray(candidateEvents.shiftId, shiftIds))
    .groupBy(candidateEvents.shiftId);

  const incentiveRows = await db
    .select({
      shiftId: incentiveLedger.shiftId,
      amount: sql<number>`coalesce(sum(${incentiveLedger.amountYen}), 0)::int`,
    })
    .from(incentiveLedger)
    .where(
      and(
        inArray(incentiveLedger.shiftId, shiftIds),
        sql`${incentiveLedger.status} <> 'rejected'`,
      ),
    )
    .groupBy(incentiveLedger.shiftId);

  const revenueRows = await db.execute(sql`
    select c.shift_id as shift_id,
           coalesce(sum(${revenueEvents.amountYen}) filter (where ${revenueEvents.status} <> 'cancelled'), 0)::int as estimated,
           coalesce(sum(${revenueEvents.amountYen}) filter (where ${revenueEvents.status} = 'confirmed'), 0)::int as confirmed
    from ${revenueEvents}
    join candidates c on c.id = ${revenueEvents.candidateId}
    where c.shift_id in ${shiftIds}
    group by 1
  `);

  const eventMap = new Map(eventRows.map((row) => [row.shiftId, row]));
  const incentiveMap = new Map(incentiveRows.map((row) => [row.shiftId, row.amount]));
  const revenueMap = new Map(
    (Array.isArray(revenueRows)
      ? revenueRows
      : (revenueRows as { rows: unknown[] }).rows
    ).map((row) => {
      const typed = row as { shift_id: number; estimated: number; confirmed: number };
      return [typed.shift_id, typed];
    }),
  );

  const result = new Map<number, ShiftMetrics>();
  for (const shift of shiftRows) {
    const events = eventMap.get(shift.id);
    const revenue = revenueMap.get(shift.id);
    const end = shift.endTime ?? shift.plannedEndTime;

    result.set(shift.id, {
      shiftId: shift.id,
      salesUserId: shift.salesUserId,
      locationId: shift.locationId,
      startTime: shift.startTime,
      endTime: shift.endTime,
      plannedEndTime: shift.plannedEndTime,
      weather: shift.weather,
      venueType: shift.venueType,
      status: shift.status,
      salesHours: Math.max(
        0,
        (end.getTime() - shift.startTime.getTime()) / (1000 * 60 * 60),
      ),
      approachCount: shift.approachCount,
      stoppedCount: shift.stoppedCount,
      scanCount: Number(events?.scanCount ?? 0),
      diagnosisStarted: Number(events?.diagnosisStarted ?? 0),
      diagnosisCompleted: Number(events?.diagnosisCompleted ?? 0),
      leadRegistered: Number(events?.leadRegistered ?? 0),
      interviewBooked: Number(events?.interviewBooked ?? 0),
      interviewCompleted: Number(events?.interviewCompleted ?? 0),
      qualifiedCount: Number(events?.qualifiedCount ?? 0),
      referralCount: Number(events?.referralCount ?? 0),
      estimatedRevenueYen: revenue?.estimated ?? 0,
      confirmedRevenueYen: revenue?.confirmed ?? 0,
      incentiveYen: incentiveMap.get(shift.id) ?? 0,
    });
  }

  return result;
}

export async function getSalesDaySummary(
  db: Database,
  salesUserId: string,
  from: Date,
  to: Date,
) {
  const rows = await db
    .select({ id: shifts.id })
    .from(shifts)
    .where(
      and(
        eq(shifts.salesUserId, salesUserId),
        gte(shifts.startTime, from),
        lte(shifts.startTime, to),
      ),
    );

  const metrics = await getShiftMetrics(
    db,
    rows.map((row) => row.id),
  );

  const totals = {
    salesHours: 0,
    approachCount: 0,
    stoppedCount: 0,
    scanCount: 0,
    diagnosisCompleted: 0,
    leadRegistered: 0,
    interviewBooked: 0,
    interviewCompleted: 0,
    qualifiedCount: 0,
    referralCount: 0,
    incentiveYen: 0,
  };

  for (const metric of metrics.values()) {
    totals.salesHours += metric.salesHours;
    totals.approachCount += metric.approachCount;
    totals.stoppedCount += metric.stoppedCount;
    totals.scanCount += metric.scanCount;
    totals.diagnosisCompleted += metric.diagnosisCompleted;
    totals.leadRegistered += metric.leadRegistered;
    totals.interviewBooked += metric.interviewBooked;
    totals.interviewCompleted += metric.interviewCompleted;
    totals.qualifiedCount += metric.qualifiedCount;
    totals.referralCount += metric.referralCount;
    totals.incentiveYen += metric.incentiveYen;
  }

  return { totals, shifts: [...metrics.values()] };
}
