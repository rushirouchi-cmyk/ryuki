import type { AreaScoreConfig, AreaScoreMetricKey } from "@/lib/config/settings";
import type { BreakdownRow } from "./types";

export interface AreaScoreResult {
  key: string;
  score: number;
  rank: "S" | "A" | "B" | "C";
  /** False when the sample is too small for the score to mean anything. */
  sufficientData: boolean;
  sampleSize: { salesHours: number; approaches: number };
  metrics: Record<string, number | null>;
}

function metricValue(row: BreakdownRow, metric: AreaScoreMetricKey): number | null {
  switch (metric) {
    case "approachesPerHour":
      return row.funnel.salesHours > 0
        ? row.funnel.approaches / row.funnel.salesHours
        : null;
    case "stopRate":
      return row.rates.stopRate;
    case "scanRate":
      return row.rates.qrRate;
    case "diagnosisCompletionRate":
      return row.rates.diagnosisCompletionRate;
    case "leadRate":
      return row.rates.registrationRate;
    case "interviewBookingRate":
      return row.rates.interviewBookingRate;
    case "interviewAttendanceRate":
      return row.rates.interviewAttendanceRate;
    case "qualifiedRate":
      return row.rates.qualifiedRate;
    case "referralRate":
      return row.rates.referralRate;
    case "revenuePerLead":
      return row.economics.revenuePerLead;
    case "revenuePerSalesHour":
      return row.economics.revenuePerSalesHour;
    case "grossProfitPerSalesHour":
      return row.economics.grossProfitPerSalesHour;
    default:
      return null;
  }
}

/**
 * Scores every area against its peers rather than against absolute targets:
 * at MVP volumes there is no reliable absolute benchmark, and the question the
 * business actually asks is "where should tomorrow's shift go".
 *
 * Rows below the configured sample floor still get a score, but it is flagged
 * as insufficient so the UI can refuse to rank a location with n=7 above one
 * with n=500.
 */
export function computeAreaScores(
  rows: readonly BreakdownRow[],
  config: AreaScoreConfig,
): Map<string, AreaScoreResult> {
  const metrics = Object.entries(config.weights).filter(([, weight]) => weight > 0) as [
    AreaScoreMetricKey,
    number,
  ][];

  const percentiles = new Map<AreaScoreMetricKey, Map<string, number>>();

  for (const [metric] of metrics) {
    const values = rows
      .map((row) => ({ key: row.key, value: metricValue(row, metric) }))
      .filter((entry): entry is { key: string; value: number } => entry.value !== null)
      .sort((a, b) => a.value - b.value);

    const map = new Map<string, number>();
    const only = values[0];
    if (values.length === 1 && only) {
      map.set(only.key, 0.5);
    } else {
      values.forEach((entry, index) => {
        map.set(entry.key, index / (values.length - 1));
      });
    }
    percentiles.set(metric, map);
  }

  const results = new Map<string, AreaScoreResult>();

  for (const row of rows) {
    let weighted = 0;
    let totalWeight = 0;
    const values: Record<string, number | null> = {};

    for (const [metric, weight] of metrics) {
      const value = metricValue(row, metric);
      values[metric] = value;
      if (value === null) continue;
      weighted += (percentiles.get(metric)?.get(row.key) ?? 0) * weight;
      totalWeight += weight;
    }

    const score = totalWeight === 0 ? 0 : Math.round((weighted / totalWeight) * 100);
    results.set(row.key, {
      key: row.key,
      score,
      rank:
        score >= config.rankThresholds.S
          ? "S"
          : score >= config.rankThresholds.A
            ? "A"
            : score >= config.rankThresholds.B
              ? "B"
              : "C",
      sufficientData:
        row.funnel.salesHours >= config.minSalesHours &&
        row.funnel.approaches >= config.minApproaches,
      sampleSize: {
        salesHours: row.funnel.salesHours,
        approaches: row.funnel.approaches,
      },
      metrics: values,
    });
  }

  return results;
}
