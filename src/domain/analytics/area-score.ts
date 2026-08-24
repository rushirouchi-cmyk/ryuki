import type { AnalyticsConfig } from '@/domain/config/analytics-config';
import type { FunnelRates } from './funnel';

export interface AreaScoreInput {
  approachesPerHour: number;
  grossProfitPerSalesHour: number;
  rates: FunnelRates;
  salesHours: number;
  approaches: number;
}

export interface AreaScoreResult {
  score: number;
  rank: 'S' | 'A' | 'B' | 'C';
  /** true when the segment has too little data to be trusted */
  lowConfidence: boolean;
  sampleSalesHours: number;
  sampleApproaches: number;
  axes: Record<string, number>;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Area Score is a weighted average of normalised funnel and profit axes.
 * Sample size travels with the score so the UI can stop a n=7 location from
 * looking better than a n=500 one.
 */
export function computeAreaScore(input: AreaScoreInput, config: AnalyticsConfig): AreaScoreResult {
  const w = config.areaScoreWeights;
  const axes: Record<string, number> = {
    approachesPerHour: clamp01(input.approachesPerHour / config.areaScoreCeilings.approachesPerHour),
    stopRate: clamp01(input.rates.stopRate),
    scanRate: clamp01(input.rates.scanRate),
    diagnosisCompletionRate: clamp01(input.rates.diagnosisCompletionRate),
    leadRate: clamp01(input.rates.registrationRate),
    interviewRate: clamp01(input.rates.interviewAttendanceRate),
    qualifiedRate: clamp01(input.rates.qualifiedRate),
    referralRate: clamp01(input.rates.referralRate),
    grossProfitPerSalesHour: clamp01(
      input.grossProfitPerSalesHour / config.areaScoreCeilings.grossProfitPerSalesHour,
    ),
  };

  const weightEntries = Object.entries(w) as [keyof typeof w, number][];
  const weightTotal = weightEntries.reduce((sum, [, weight]) => sum + weight, 0);
  const weighted = weightEntries.reduce((sum, [key, weight]) => sum + (axes[key] ?? 0) * weight, 0);
  const score = weightTotal > 0 ? Math.round((weighted / weightTotal) * 100) : 0;

  const t = config.areaScoreRankThresholds;
  const rank = score >= t.S ? 'S' : score >= t.A ? 'A' : score >= t.B ? 'B' : 'C';

  return {
    score,
    rank,
    lowConfidence:
      input.salesHours < config.lowSampleSalesHours || input.approaches < config.lowSampleApproaches,
    sampleSalesHours: input.salesHours,
    sampleApproaches: input.approaches,
    axes,
  };
}
