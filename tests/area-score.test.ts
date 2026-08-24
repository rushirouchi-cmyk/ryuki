import { describe, expect, it } from "vitest";
import { DEFAULT_AREA_SCORE_CONFIG } from "@/lib/config/settings";
import { computeAreaScores } from "@/lib/analytics/area-score";
import { computeRates, computeUnitEconomics } from "@/lib/analytics/metrics";
import type { BreakdownRow, FunnelCounts } from "@/lib/analytics/types";

const config = DEFAULT_AREA_SCORE_CONFIG;

function row(
  key: string,
  funnel: Partial<FunnelCounts>,
  confirmedRevenueYen = 0,
  incentiveYen = 0,
): BreakdownRow {
  const counts: FunnelCounts = {
    salesHours: 0,
    approaches: 0,
    stops: 0,
    scans: 0,
    diagnosisStarted: 0,
    diagnosisCompleted: 0,
    leads: 0,
    interviewBooked: 0,
    interviewCompleted: 0,
    qualified: 0,
    referrals: 0,
    offers: 0,
    joins: 0,
    ...funnel,
  };
  const financials = {
    estimatedRevenueYen: confirmedRevenueYen,
    confirmedRevenueYen,
    incentiveYen,
    otherAcquisitionCostYen: 0,
    contributionMarginYen: confirmedRevenueYen - incentiveYen,
  };
  return {
    key,
    label: key,
    funnel: counts,
    rates: computeRates(counts),
    financials,
    economics: computeUnitEconomics(counts, financials),
  };
}

describe("area score", () => {
  const strong = row(
    "strong",
    {
      salesHours: 100,
      approaches: 2_000,
      stops: 300,
      scans: 150,
      diagnosisStarted: 140,
      diagnosisCompleted: 120,
      leads: 60,
      interviewBooked: 30,
      interviewCompleted: 20,
      qualified: 15,
      referrals: 12,
    },
    2_000_000,
    200_000,
  );
  const weak = row(
    "weak",
    {
      salesHours: 100,
      approaches: 1_200,
      stops: 100,
      scans: 30,
      diagnosisStarted: 28,
      diagnosisCompleted: 20,
      leads: 5,
      interviewBooked: 4,
      interviewCompleted: 1,
      qualified: 0,
      referrals: 0,
    },
    100_000,
    200_000,
  );
  /* Tiny sample that happens to convert perfectly. */
  const lucky = row(
    "lucky",
    {
      salesHours: 3,
      approaches: 20,
      stops: 10,
      scans: 8,
      diagnosisStarted: 8,
      diagnosisCompleted: 8,
      leads: 6,
      interviewBooked: 4,
      interviewCompleted: 3,
      qualified: 3,
      referrals: 3,
    },
    400_000,
    10_000,
  );

  it("ranks the genuinely stronger area above the weaker one", () => {
    const scores = computeAreaScores([strong, weak], config);
    expect(scores.get("strong")!.score).toBeGreaterThan(scores.get("weak")!.score);
  });

  it("flags a high-scoring area whose sample is too small to trust", () => {
    const scores = computeAreaScores([strong, weak, lucky], config);
    expect(scores.get("lucky")!.sufficientData).toBe(false);
    expect(scores.get("strong")!.sufficientData).toBe(true);
    /* The sample size travels with the score so the UI can show both. */
    expect(scores.get("lucky")!.sampleSize.approaches).toBe(20);
  });

  it("gives a lone area a mid percentile rather than a perfect score", () => {
    const scores = computeAreaScores([strong], config);
    expect(scores.get("strong")!.score).toBe(50);
  });

  it("gives areas with identical metrics identical scores", () => {
    const twin = { ...strong, key: "twin", label: "twin" };
    const scores = computeAreaScores([strong, twin], config);
    expect(scores.get("strong")!.score).toBe(scores.get("twin")!.score);
    expect(scores.get("strong")!.score).toBe(50);
  });

  it("follows the configured rank thresholds", () => {
    const scores = computeAreaScores([strong, weak], {
      ...config,
      rankThresholds: { S: 90, A: 60, B: 30 },
    });
    expect(scores.get("strong")!.rank).toBe("S");
    expect(scores.get("weak")!.rank).toBe("C");
  });

  it("ignores metrics whose weight is zero", () => {
    const onlyGrossProfit = computeAreaScores([strong, weak], {
      ...config,
      weights: { grossProfitPerSalesHour: 100 },
    });
    expect(onlyGrossProfit.get("strong")!.score).toBe(100);
    expect(onlyGrossProfit.get("weak")!.score).toBe(0);
  });

  it("handles an empty dataset", () => {
    expect(computeAreaScores([], config).size).toBe(0);
  });
});

describe("unit economics", () => {
  it("computes gross profit per sales hour from confirmed revenue only", () => {
    const counts: FunnelCounts = {
      salesHours: 10,
      approaches: 100,
      stops: 20,
      scans: 10,
      diagnosisStarted: 9,
      diagnosisCompleted: 8,
      leads: 4,
      interviewBooked: 2,
      interviewCompleted: 1,
      qualified: 1,
      referrals: 1,
      offers: 0,
      joins: 0,
    };
    const economics = computeUnitEconomics(counts, {
      estimatedRevenueYen: 500_000,
      confirmedRevenueYen: 200_000,
      incentiveYen: 50_000,
      otherAcquisitionCostYen: 10_000,
      contributionMarginYen: 140_000,
    });

    expect(economics.grossProfitPerSalesHour).toBe(14_000);
    expect(economics.costPerLead).toBe(15_000);
    expect(economics.revenuePerSalesHour).toBe(20_000);
    expect(economics.costPerQualified).toBe(60_000);
  });
});
