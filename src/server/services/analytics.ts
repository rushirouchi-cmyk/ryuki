import 'server-only';
import { and, gte, lt, sql, type SQL } from 'drizzle-orm';
import { getDb, schema } from '@/db/client';
import { getAnalyticsConfig } from '@/server/settings';
import type { AnalyticsConfig } from '@/domain/config/analytics-config';
import {
  computeRates,
  computeUnitEconomics,
  countFunnel,
  type AcquisitionCounts,
  type CandidateEventRow,
  type FunnelRates,
  type UnitEconomics,
} from '@/domain/analytics/funnel';
import { computeAreaScore, type AreaScoreResult } from '@/domain/analytics/area-score';
import { dayOfWeekLabel, resolveTimeBand } from '@/domain/analytics/time-bands';

export interface AnalyticsFilters {
  from: Date;
  to: Date;
  prefecture?: string;
  city?: string;
  locationId?: string;
  venueType?: string;
  salesUserId?: string;
  weather?: string;
  dayOfWeek?: number;
  timeBand?: string;
}

export interface ShiftRow {
  shiftId: string;
  salesUserId: string;
  salesUserName: string;
  locationId: string;
  venueName: string;
  prefecture: string;
  city: string;
  venueType: string;
  weather: string | null;
  startTime: Date;
  endTime: Date | null;
  approachCount: number;
  stoppedCount: number;
  hours: number;
}

export interface CohortDataset {
  config: AnalyticsConfig;
  shifts: ShiftRow[];
  /** candidate events of everyone acquired by those shifts, whenever they happened */
  events: (CandidateEventRow & { shiftId: string | null })[];
  incentives: { shiftId: string | null; salesUserId: string; amount: number; status: string }[];
  revenue: { shiftId: string | null; amount: number; status: string }[];
}

function activeHours(startTime: Date, endTime: Date | null, now: Date): number {
  const end = endTime ?? now;
  return Math.max(0, (end.getTime() - startTime.getTime()) / 3_600_000);
}

/**
 * Cohort model: a period selects the *shifts* worked in it, and every downstream
 * result of the candidates those shifts acquired — whenever it lands. This is
 * the only way Revenue / Sales Hour and GP / Sales Hour mean anything.
 */
export async function loadCohortDataset(filters: AnalyticsFilters): Promise<CohortDataset> {
  const db = getDb();
  const config = await getAnalyticsConfig();
  const now = new Date();

  const conditions: SQL[] = [
    gte(schema.shifts.startTime, filters.from),
    lt(schema.shifts.startTime, filters.to),
  ];
  if (filters.prefecture) conditions.push(sql`${schema.locations.prefecture} = ${filters.prefecture}`);
  if (filters.city) conditions.push(sql`${schema.locations.city} = ${filters.city}`);
  if (filters.locationId) conditions.push(sql`${schema.shifts.locationId} = ${filters.locationId}`);
  if (filters.venueType) conditions.push(sql`${schema.shifts.venueType}::text = ${filters.venueType}`);
  if (filters.salesUserId) conditions.push(sql`${schema.shifts.salesUserId} = ${filters.salesUserId}`);
  if (filters.weather) conditions.push(sql`${schema.shifts.weather}::text = ${filters.weather}`);

  const rows = await db
    .select({
      shiftId: schema.shifts.id,
      salesUserId: schema.shifts.salesUserId,
      salesUserName: schema.users.displayName,
      locationId: schema.shifts.locationId,
      venueName: schema.locations.venueName,
      prefecture: schema.locations.prefecture,
      city: schema.locations.city,
      venueType: schema.shifts.venueType,
      weather: schema.shifts.weather,
      startTime: schema.shifts.startTime,
      endTime: schema.shifts.endTime,
      approachCount: schema.shifts.approachCount,
      stoppedCount: schema.shifts.stoppedCount,
    })
    .from(schema.shifts)
    .innerJoin(schema.locations, sql`${schema.locations.id} = ${schema.shifts.locationId}`)
    .innerJoin(schema.users, sql`${schema.users.id} = ${schema.shifts.salesUserId}`)
    .where(and(...conditions));

  let shifts: ShiftRow[] = rows.map((r) => ({
    ...r,
    weather: r.weather,
    hours: activeHours(r.startTime, r.endTime, now),
  }));

  if (filters.dayOfWeek !== undefined) {
    shifts = shifts.filter((s) => s.startTime.getDay() === filters.dayOfWeek);
  }
  if (filters.timeBand) {
    shifts = shifts.filter((s) => resolveTimeBand(s.startTime, config)?.label === filters.timeBand);
  }

  const shiftIds = shifts.map((s) => s.shiftId);
  if (shiftIds.length === 0) {
    return { config, shifts, events: [], incentives: [], revenue: [] };
  }

  const idList = sql.join(
    shiftIds.map((id) => sql`${id}::uuid`),
    sql`, `,
  );

  const events = await db
    .select({
      candidateId: schema.candidateEvents.candidateId,
      eventType: schema.candidateEvents.eventType,
      shiftId: schema.candidateAttributions.shiftId,
    })
    .from(schema.candidateEvents)
    .innerJoin(
      schema.candidateAttributions,
      sql`${schema.candidateAttributions.candidateId} = ${schema.candidateEvents.candidateId}`,
    )
    .where(sql`${schema.candidateAttributions.shiftId} in (${idList})`);

  const incentives = await db
    .select({
      shiftId: schema.incentiveLedger.shiftId,
      salesUserId: schema.incentiveLedger.salesUserId,
      amount: schema.incentiveLedger.amount,
      status: schema.incentiveLedger.status,
    })
    .from(schema.incentiveLedger)
    .where(sql`${schema.incentiveLedger.shiftId} in (${idList})`);

  const revenue = await db
    .select({
      shiftId: schema.candidateAttributions.shiftId,
      amount: schema.revenueEvents.amount,
      status: schema.revenueEvents.status,
    })
    .from(schema.revenueEvents)
    .innerJoin(
      schema.candidateAttributions,
      sql`${schema.candidateAttributions.candidateId} = ${schema.revenueEvents.candidateId}`,
    )
    .where(sql`${schema.candidateAttributions.shiftId} in (${idList})`);

  return { config, shifts, events, incentives, revenue };
}

export interface Segment {
  key: string;
  label: string;
  sublabel?: string;
  counts: AcquisitionCounts;
  rates: FunnelRates;
  economics: UnitEconomics;
  areaScore: AreaScoreResult;
  shiftCount: number;
}

function buildSegment(
  key: string,
  label: string,
  shifts: ShiftRow[],
  dataset: CohortDataset,
  sublabel?: string,
): Segment {
  const shiftIds = new Set(shifts.map((s) => s.shiftId));
  const events = dataset.events.filter((e) => e.shiftId && shiftIds.has(e.shiftId));
  const funnel = countFunnel(events);
  const salesHours = shifts.reduce((sum, s) => sum + s.hours, 0);
  const counts: AcquisitionCounts = {
    ...funnel,
    approaches: shifts.reduce((sum, s) => sum + s.approachCount, 0),
    stops: shifts.reduce((sum, s) => sum + s.stoppedCount, 0),
    salesHours,
  };
  const rates = computeRates(counts);

  const incentiveAmount = dataset.incentives
    .filter((i) => i.shiftId && shiftIds.has(i.shiftId) && i.status !== 'rejected')
    .reduce((sum, i) => sum + i.amount, 0);
  const relevantRevenue = dataset.revenue.filter((r) => r.shiftId && shiftIds.has(r.shiftId));
  const estimatedRevenue = relevantRevenue.reduce((sum, r) => sum + r.amount, 0);
  const confirmedRevenue = relevantRevenue
    .filter((r) => r.status === 'confirmed')
    .reduce((sum, r) => sum + r.amount, 0);

  const economics = computeUnitEconomics(
    { salesHours, estimatedRevenue, confirmedRevenue, incentiveAmount, counts },
    dataset.config,
  );

  const areaScore = computeAreaScore(
    {
      approachesPerHour: salesHours > 0 ? counts.approaches / salesHours : 0,
      grossProfitPerSalesHour: economics.grossProfitPerSalesHour,
      rates,
      salesHours,
      approaches: counts.approaches,
    },
    dataset.config,
  );

  return { key, label, sublabel, counts, rates, economics, areaScore, shiftCount: shifts.length };
}

export function segmentAll(dataset: CohortDataset, label = '全体'): Segment {
  return buildSegment('all', label, dataset.shifts, dataset);
}

type GroupKeyFn = (shift: ShiftRow, config: AnalyticsConfig) => { key: string; label: string; sublabel?: string } | null;

function groupBy(dataset: CohortDataset, keyFn: GroupKeyFn): Segment[] {
  const groups = new Map<string, { label: string; sublabel?: string; shifts: ShiftRow[] }>();
  for (const shift of dataset.shifts) {
    const resolved = keyFn(shift, dataset.config);
    if (!resolved) continue;
    const existing = groups.get(resolved.key);
    if (existing) existing.shifts.push(shift);
    else groups.set(resolved.key, { label: resolved.label, sublabel: resolved.sublabel, shifts: [shift] });
  }
  return [...groups.entries()]
    .map(([key, group]) => buildSegment(key, group.label, group.shifts, dataset, group.sublabel))
    .sort((a, b) => b.economics.grossProfitPerSalesHour - a.economics.grossProfitPerSalesHour);
}

export function segmentByLocation(dataset: CohortDataset): Segment[] {
  return groupBy(dataset, (s) => ({
    key: s.locationId,
    label: s.venueName,
    sublabel: `${s.prefecture}${s.city}`,
  }));
}

export function segmentByVenueType(dataset: CohortDataset): Segment[] {
  return groupBy(dataset, (s) => ({ key: s.venueType, label: s.venueType }));
}

export function segmentBySalesUser(dataset: CohortDataset): Segment[] {
  return groupBy(dataset, (s) => ({ key: s.salesUserId, label: s.salesUserName }));
}

export function segmentByWeather(dataset: CohortDataset): Segment[] {
  return groupBy(dataset, (s) => (s.weather ? { key: s.weather, label: s.weather } : null));
}

export function segmentByDayOfWeek(dataset: CohortDataset): Segment[] {
  return groupBy(dataset, (s) => ({
    key: String(s.startTime.getDay()),
    label: `${dayOfWeekLabel(s.startTime)}曜日`,
  })).sort((a, b) => Number(a.key) - Number(b.key));
}

export function segmentByTimeBand(dataset: CohortDataset): Segment[] {
  return groupBy(dataset, (s, config) => {
    const band = resolveTimeBand(s.startTime, config);
    return band ? { key: band.label, label: band.label } : null;
  });
}

/** Area x Day of Week x Time Band — the resolution the business actually needs. */
export function segmentByAreaDayTime(dataset: CohortDataset): Segment[] {
  return groupBy(dataset, (s, config) => {
    const band = resolveTimeBand(s.startTime, config);
    if (!band) return null;
    return {
      key: `${s.locationId}|${s.startTime.getDay()}|${band.label}`,
      label: s.venueName,
      sublabel: `${dayOfWeekLabel(s.startTime)}曜 ${band.label}`,
    };
  });
}

/** Event-date funnel, used by the top dashboard alongside the cohort view. */
export async function loadPeriodFunnel(from: Date, to: Date): Promise<AcquisitionCounts> {
  const db = getDb();
  const events = await db
    .select({
      candidateId: schema.candidateEvents.candidateId,
      eventType: schema.candidateEvents.eventType,
    })
    .from(schema.candidateEvents)
    .where(and(gte(schema.candidateEvents.createdAt, from), lt(schema.candidateEvents.createdAt, to)));

  const shiftRows = await db
    .select({
      approachCount: schema.shifts.approachCount,
      stoppedCount: schema.shifts.stoppedCount,
      startTime: schema.shifts.startTime,
      endTime: schema.shifts.endTime,
    })
    .from(schema.shifts)
    .where(and(gte(schema.shifts.startTime, from), lt(schema.shifts.startTime, to)));

  const now = new Date();
  return {
    ...countFunnel(events),
    approaches: shiftRows.reduce((sum, s) => sum + s.approachCount, 0),
    stops: shiftRows.reduce((sum, s) => sum + s.stoppedCount, 0),
    salesHours: shiftRows.reduce((sum, s) => sum + activeHours(s.startTime, s.endTime, now), 0),
  };
}
