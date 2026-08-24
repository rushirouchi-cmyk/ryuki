import "dotenv/config";
import { getDb } from "../src/lib/db";
import { getBreakdown, getDailySeries, getOverview } from "../src/lib/analytics/queries";
import { getAgentPerformance } from "../src/lib/analytics/agents";
import { computeAreaScores } from "../src/lib/analytics/area-score";
import { getAreaScoreConfig } from "../src/lib/config/store";
import type { BreakdownDimension } from "../src/lib/analytics/types";

const db = await getDb();
const filter = { from: new Date(2000, 0, 1), to: new Date() };

const overview = await getOverview(db, filter);
console.log("overview funnel:", overview.funnel);
console.log("overview financials:", overview.financials);

const dims: BreakdownDimension[] = [
  "location", "venue_type", "prefecture", "city", "sales_user",
  "weekday", "time_band", "weather", "area_time_band",
];
for (const dim of dims) {
  const rows = await getBreakdown(db, filter, dim);
  console.log(
    `${dim}: ${rows.length} rows; top=`,
    rows[0]?.label,
    rows[0]?.funnel.salesHours.toFixed(1),
    rows[0]?.funnel.leads,
    rows[0]?.financials.confirmedRevenueYen,
  );
}

const config = await getAreaScoreConfig(db);
const locRows = await getBreakdown(db, filter, "location");
const scores = computeAreaScores(locRows, config);
console.log(
  "area scores:",
  [...scores.values()]
    .map((s) => `${s.key}:${s.score}${s.rank}${s.sufficientData ? "" : "*"}`)
    .join(" "),
);

console.log("daily points:", (await getDailySeries(db, filter)).length);
console.log(
  "agents:",
  (await getAgentPerformance(db, filter.from, filter.to)).map(
    (a) => `${a.name} ref=${a.referrals} joined=${a.joined} rev=${a.confirmedRevenueYen}`,
  ),
);

const filtered = await getBreakdown(
  db,
  { ...filter, venueTypes: ["shopping_mall"], weekdays: [6] },
  "location",
);
console.log(
  "filtered (mall x sat):",
  filtered.map((r) => `${r.label}=${r.funnel.approaches}`).join(", "),
);
process.exit(0);
