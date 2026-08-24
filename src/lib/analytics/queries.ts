import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/lib/db";
import {
  acquisitionCosts,
  candidateEvents,
  candidates,
  incentiveLedger,
  locations,
  revenueEvents,
  shifts,
  users,
} from "@/lib/db/schema";
import { toRows } from "@/lib/db/migrate";
import { computeRates, computeUnitEconomics } from "./metrics";
import {
  APP_TIMEZONE,
  EMPTY_FINANCIALS,
  EMPTY_FUNNEL,
  TIME_BANDS,
  type AnalyticsFilter,
  type BreakdownDimension,
  type BreakdownRow,
  type FinancialTotals,
  type FunnelCounts,
} from "./types";

const TZ = sql.raw(`'${APP_TIMEZONE}'`);

/* -------------------------------------------------------------------------- */
/* Filter helpers                                                             */
/* -------------------------------------------------------------------------- */

const shiftHour = sql`extract(hour from ${shifts.startTime} at time zone ${TZ})`;
const shiftDow = sql`extract(dow from ${shifts.startTime} at time zone ${TZ})`;

/** `time_band` derived in SQL from the same table that drives the UI labels. */
const timeBandExpr = sql`case ${sql.join(
  TIME_BANDS.filter((band) => band.key !== "other").map(
    (band) =>
      sql`when ${shiftHour} >= ${band.startHour} and ${shiftHour} < ${band.endHour} then ${band.key}`,
  ),
  sql` `,
)} else 'other' end`;

/**
 * Dimension filters always describe the *acquisition context* (which shift the
 * candidate came from), never when the downstream event happened. That is what
 * makes "revenue earned by candidates acquired in 西宮北口" answerable.
 */
function dimensionConditions(filter: AnalyticsFilter): SQL[] {
  const conditions: SQL[] = [];
  if (filter.locationIds?.length) {
    conditions.push(inArray(shifts.locationId, filter.locationIds));
  }
  if (filter.prefectures?.length) {
    conditions.push(inArray(locations.prefecture, filter.prefectures));
  }
  if (filter.cities?.length) conditions.push(inArray(locations.city, filter.cities));
  if (filter.venueTypes?.length) {
    conditions.push(inArray(locations.venueType, filter.venueTypes as never[]));
  }
  if (filter.salesUserIds?.length) {
    conditions.push(inArray(shifts.salesUserId, filter.salesUserIds));
  }
  if (filter.weather?.length) {
    conditions.push(inArray(shifts.weather, filter.weather as never[]));
  }
  if (filter.weekdays?.length) {
    conditions.push(sql`${shiftDow} in ${filter.weekdays}`);
  }
  if (filter.timeBands?.length) {
    conditions.push(sql`${timeBandExpr} in ${filter.timeBands}`);
  }
  return conditions;
}

function allConditions(filter: AnalyticsFilter, timeColumn: SQL | ReturnType<typeof sql>) {
  return and(
    sql`${timeColumn} >= ${filter.from}`,
    sql`${timeColumn} <= ${filter.to}`,
    ...dimensionConditions(filter),
  );
}

/* -------------------------------------------------------------------------- */
/* Group key expressions                                                      */
/* -------------------------------------------------------------------------- */

interface DimensionSpec {
  key: SQL;
  label: SQL;
  sublabel?: SQL;
  /** Extra joins required beyond shifts + locations. */
  needsUser?: boolean;
}

const WEEKDAY_LABEL = sql`case ${shiftDow}
  when 0 then '日' when 1 then '月' when 2 then '火' when 3 then '水'
  when 4 then '木' when 5 then '金' else '土' end`;

const VENUE_LABEL = sql`case ${locations.venueType}
  when 'shopping_mall' then '大型商業施設'
  when 'station' then '駅前'
  when 'shopping_street' then '商店街'
  when 'residential_area' then '住宅街'
  when 'park' then '公園'
  when 'supermarket' then 'スーパー'
  when 'home_center' then 'ホームセンター'
  when 'event' then 'イベント'
  else 'その他' end`;

function dimensionSpec(dimension: BreakdownDimension): DimensionSpec {
  switch (dimension) {
    case "location":
      return {
        key: sql`${shifts.locationId}::text`,
        label: sql`${locations.venueName}`,
        sublabel: sql`${locations.prefecture} || ' ' || ${locations.city}`,
      };
    case "venue_type":
      return { key: sql`${locations.venueType}::text`, label: VENUE_LABEL };
    case "prefecture":
      return { key: sql`${locations.prefecture}`, label: sql`${locations.prefecture}` };
    case "city":
      return {
        key: sql`${locations.prefecture} || '/' || ${locations.city}`,
        label: sql`${locations.city}`,
        sublabel: sql`${locations.prefecture}`,
      };
    case "sales_user":
      return {
        key: sql`${shifts.salesUserId}::text`,
        label: sql`${users.name}`,
        needsUser: true,
      };
    case "weekday":
      return { key: sql`${shiftDow}::text`, label: WEEKDAY_LABEL };
    case "time_band":
      return { key: timeBandExpr, label: timeBandExpr };
    case "weather":
      return {
        key: sql`coalesce(${shifts.weather}::text, 'unknown')`,
        label: sql`case ${shifts.weather}
          when 'sunny' then '晴れ' when 'cloudy' then '曇り' when 'rainy' then '雨'
          when 'snowy' then '雪' when 'hot' then '猛暑' when 'cold' then '厳寒'
          else '未入力' end`,
      };
    case "area_time_band":
      return {
        key: sql`${shifts.locationId}::text || '|' || ${shiftDow}::text || '|' || ${timeBandExpr}`,
        label: sql`${locations.venueName}`,
        sublabel: sql`${WEEKDAY_LABEL} || '曜 ' || ${timeBandExpr}`,
      };
  }
}

/* -------------------------------------------------------------------------- */
/* Aggregation                                                                */
/* -------------------------------------------------------------------------- */

const EVENT_COUNT_COLUMNS = {
  scans: "qr_scanned",
  diagnosisStarted: "diagnosis_started",
  diagnosisCompleted: "diagnosis_completed",
  leads: "lead_registered",
  interviewBooked: "interview_booked",
  interviewCompleted: "interview_completed",
  qualified: "candidate_qualified",
  referrals: "agent_referred",
  offers: "offer_received",
  joins: "joined",
} as const satisfies Record<string, string>;

type EventCountKey = keyof typeof EVENT_COUNT_COLUMNS;

function eventCountSelection() {
  const selection: Record<string, SQL<number>> = {};
  for (const [field, eventType] of Object.entries(EVENT_COUNT_COLUMNS)) {
    selection[field] = sql<number>`count(*) filter (where ${candidateEvents.eventType} = ${eventType})::int`;
  }
  return selection as Record<EventCountKey, SQL<number>>;
}

const SALES_HOURS = sql<number>`coalesce(sum(extract(epoch from (coalesce(${shifts.endTime}, ${shifts.plannedEndTime}) - ${shifts.startTime})) / 3600.0), 0)::float8`;

/** Aggregated funnel + money for the whole filtered period. */
export async function getOverview(
  db: Database,
  filter: AnalyticsFilter,
): Promise<{ funnel: FunnelCounts; financials: FinancialTotals }> {
  const [rows] = await getBreakdown(db, filter, null);
  return {
    funnel: rows?.funnel ?? { ...EMPTY_FUNNEL },
    financials: rows?.financials ?? { ...EMPTY_FINANCIALS },
  };
}

/**
 * One breakdown query per fact source (shifts, events, incentives, revenue,
 * direct costs), merged in TypeScript. Keeping them separate avoids fan-out
 * double counting when a shift has many events and many ledger rows.
 */
export async function getBreakdown(
  db: Database,
  filter: AnalyticsFilter,
  dimension: BreakdownDimension | null,
): Promise<BreakdownRow[]> {
  const spec = dimension ? dimensionSpec(dimension) : null;
  const groupKey = spec?.key ?? sql`'all'`;
  const groupLabel = spec?.label ?? sql`'全体'`;
  const groupSublabel = spec?.sublabel ?? sql`null`;

  /* Sales effort comes from the shifts overlapping the period. */
  const shiftQuery = db
    .select({
      key: sql<string>`${groupKey}`.as("key"),
      label: sql<string>`${groupLabel}`.as("label"),
      sublabel: sql<string | null>`${groupSublabel}`.as("sublabel"),
      salesHours: SALES_HOURS.as("sales_hours"),
      approaches: sql<number>`coalesce(sum(${shifts.approachCount}), 0)::int`.as("approaches"),
      stops: sql<number>`coalesce(sum(${shifts.stoppedCount}), 0)::int`.as("stops"),
    })
    .from(shifts)
    .innerJoin(locations, eq(shifts.locationId, locations.id))
    .$dynamic();

  if (spec?.needsUser) shiftQuery.innerJoin(users, eq(shifts.salesUserId, users.id));

  const shiftRows = await shiftQuery
    .where(allConditions(filter, sql`${shifts.startTime}`))
    .groupBy(sql`1, 2, 3`);

  /* Funnel counts come from the append-only event log. */
  const eventQuery = db
    .select({
      key: sql<string>`${groupKey}`.as("key"),
      label: sql<string>`${groupLabel}`.as("label"),
      sublabel: sql<string | null>`${groupSublabel}`.as("sublabel"),
      ...eventCountSelection(),
    })
    .from(candidateEvents)
    .innerJoin(shifts, eq(candidateEvents.shiftId, shifts.id))
    .innerJoin(locations, eq(shifts.locationId, locations.id))
    .$dynamic();

  if (spec?.needsUser) eventQuery.innerJoin(users, eq(shifts.salesUserId, users.id));

  const eventRows = await eventQuery
    .where(allConditions(filter, sql`${candidateEvents.createdAt}`))
    .groupBy(sql`1, 2, 3`);

  /* Money. */
  const incentiveQuery = db
    .select({
      key: sql<string>`${groupKey}`.as("key"),
      amount: sql<number>`coalesce(sum(${incentiveLedger.amountYen}), 0)::int`,
    })
    .from(incentiveLedger)
    .innerJoin(shifts, eq(incentiveLedger.shiftId, shifts.id))
    .innerJoin(locations, eq(shifts.locationId, locations.id))
    .$dynamic();
  if (spec?.needsUser) incentiveQuery.innerJoin(users, eq(shifts.salesUserId, users.id));
  const incentiveRows = await incentiveQuery
    .where(
      and(
        allConditions(filter, sql`${incentiveLedger.occurredAt}`),
        sql`${incentiveLedger.status} <> 'rejected'`,
      ),
    )
    .groupBy(sql`1`);

  /* Revenue is attributed through the candidate's acquisition shift. */
  const revenueRows = await db
    .select({
      key: sql<string>`${groupKey}`.as("key"),
      estimated: sql<number>`coalesce(sum(${revenueEvents.amountYen}) filter (where ${revenueEvents.status} <> 'cancelled'), 0)::int`,
      confirmed: sql<number>`coalesce(sum(${revenueEvents.amountYen}) filter (where ${revenueEvents.status} = 'confirmed'), 0)::int`,
    })
    .from(revenueEvents)
    .innerJoin(candidates, eq(revenueEvents.candidateId, candidates.id))
    .innerJoin(shifts, eq(candidates.shiftId, shifts.id))
    .innerJoin(locations, eq(shifts.locationId, locations.id))
    .where(allConditions(filter, sql`${revenueEvents.occurredAt}`))
    .groupBy(sql`1`);

  const costRows = await db
    .select({
      key: sql<string>`${groupKey}`.as("key"),
      amount: sql<number>`coalesce(sum(${acquisitionCosts.amountYen}), 0)::int`,
    })
    .from(acquisitionCosts)
    .innerJoin(shifts, eq(acquisitionCosts.shiftId, shifts.id))
    .innerJoin(locations, eq(shifts.locationId, locations.id))
    .where(allConditions(filter, sql`${acquisitionCosts.incurredOn}::timestamptz`))
    .groupBy(sql`1`);

  /* Merge */
  const merged = new Map<string, BreakdownRow>();

  const ensure = (key: string, label: string, sublabel: string | null): BreakdownRow => {
    const existing = merged.get(key);
    if (existing) return existing;
    const row: BreakdownRow = {
      key,
      label,
      sublabel: sublabel ?? undefined,
      funnel: { ...EMPTY_FUNNEL },
      rates: computeRates(EMPTY_FUNNEL),
      financials: { ...EMPTY_FINANCIALS },
      economics: computeUnitEconomics(EMPTY_FUNNEL, EMPTY_FINANCIALS),
    };
    merged.set(key, row);
    return row;
  };

  for (const row of shiftRows) {
    const target = ensure(row.key, row.label, row.sublabel);
    target.funnel.salesHours = Number(row.salesHours);
    target.funnel.approaches = row.approaches;
    target.funnel.stops = row.stops;
  }
  for (const row of eventRows) {
    const target = ensure(row.key, row.label, row.sublabel);
    for (const field of Object.keys(EVENT_COUNT_COLUMNS) as EventCountKey[]) {
      target.funnel[field] = Number(row[field] ?? 0);
    }
  }
  for (const row of incentiveRows) {
    ensure(row.key, row.key, null).financials.incentiveYen = row.amount;
  }
  for (const row of revenueRows) {
    const target = ensure(row.key, row.key, null);
    target.financials.estimatedRevenueYen = row.estimated;
    target.financials.confirmedRevenueYen = row.confirmed;
  }
  for (const row of costRows) {
    ensure(row.key, row.key, null).financials.otherAcquisitionCostYen = row.amount;
  }

  for (const row of merged.values()) {
    row.financials.contributionMarginYen =
      row.financials.confirmedRevenueYen -
      row.financials.incentiveYen -
      row.financials.otherAcquisitionCostYen;
    row.rates = computeRates(row.funnel);
    row.economics = computeUnitEconomics(row.funnel, row.financials);
  }

  return [...merged.values()].sort(
    (a, b) => b.funnel.salesHours - a.funnel.salesHours || a.key.localeCompare(b.key),
  );
}

/** Daily series for the dashboard trend chart. */
export async function getDailySeries(
  db: Database,
  filter: AnalyticsFilter,
): Promise<{ date: string; scans: number; leads: number; qualified: number }[]> {
  const result = await db.execute(sql`
    select to_char(${candidateEvents.createdAt} at time zone ${TZ}, 'YYYY-MM-DD') as date,
           count(*) filter (where ${candidateEvents.eventType} = 'qr_scanned')::int as scans,
           count(*) filter (where ${candidateEvents.eventType} = 'lead_registered')::int as leads,
           count(*) filter (where ${candidateEvents.eventType} = 'candidate_qualified')::int as qualified
    from ${candidateEvents}
    left join ${shifts} on ${shifts.id} = ${candidateEvents.shiftId}
    left join ${locations} on ${locations.id} = ${shifts.locationId}
    where ${candidateEvents.createdAt} >= ${filter.from}
      and ${candidateEvents.createdAt} <= ${filter.to}
    group by 1
    order by 1
  `);

  return toRows<{ date: string; scans: number; leads: number; qualified: number }>(result);
}

export async function getFilterOptions(db: Database) {
  const [locationRows, salesRows] = await Promise.all([
    db
      .select({
        id: locations.id,
        venueName: locations.venueName,
        prefecture: locations.prefecture,
        city: locations.city,
        venueType: locations.venueType,
      })
      .from(locations)
      .where(eq(locations.active, true))
      .orderBy(locations.prefecture, locations.city),
    db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(and(eq(users.role, "sales"), eq(users.active, true)))
      .orderBy(users.name),
  ]);

  return {
    locations: locationRows,
    salesUsers: salesRows,
    prefectures: [...new Set(locationRows.map((row) => row.prefecture))],
    venueTypes: [...new Set(locationRows.map((row) => row.venueType))],
  };
}
