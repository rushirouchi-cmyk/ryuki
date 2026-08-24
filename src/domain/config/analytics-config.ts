import { z } from 'zod';

/** Weights of the Area Score. Sum is normalised at calculation time. */
export const areaScoreWeightsSchema = z.object({
  approachesPerHour: z.number().min(0),
  stopRate: z.number().min(0),
  scanRate: z.number().min(0),
  diagnosisCompletionRate: z.number().min(0),
  leadRate: z.number().min(0),
  interviewRate: z.number().min(0),
  qualifiedRate: z.number().min(0),
  referralRate: z.number().min(0),
  grossProfitPerSalesHour: z.number().min(0),
});

export const analyticsConfigSchema = z.object({
  areaScoreWeights: areaScoreWeightsSchema,
  /** normalisation ceilings — the value that scores 100 on each axis */
  areaScoreCeilings: z.object({
    approachesPerHour: z.number().min(1),
    grossProfitPerSalesHour: z.number().min(1),
  }),
  /** below this many sales hours a segment is flagged as low confidence in the UI */
  lowSampleSalesHours: z.number().min(0),
  /** below this many approaches a segment is flagged as low confidence */
  lowSampleApproaches: z.number().int().min(0),
  /** non-incentive acquisition cost per sales hour (transport, tools, permits, JPY) */
  otherCostPerSalesHourJpy: z.number().int().min(0),
  /** hourly wage paid to sales reps on top of incentives (JPY) */
  salesBaseHourlyWageJpy: z.number().int().min(0),
  /** time bands used by the Area x Day x Time analysis */
  timeBands: z
    .array(z.object({ label: z.string(), startHour: z.number().int().min(0).max(23), endHour: z.number().int().min(1).max(24) }))
    .min(1),
  areaScoreRankThresholds: z.object({ S: z.number(), A: z.number(), B: z.number() }),
});

export type AnalyticsConfig = z.infer<typeof analyticsConfigSchema>;

export const DEFAULT_ANALYTICS_CONFIG: AnalyticsConfig = {
  areaScoreWeights: {
    approachesPerHour: 1,
    stopRate: 1,
    scanRate: 1.5,
    diagnosisCompletionRate: 1.5,
    leadRate: 2,
    interviewRate: 2,
    qualifiedRate: 2,
    referralRate: 2,
    grossProfitPerSalesHour: 3,
  },
  areaScoreCeilings: {
    approachesPerHour: 30,
    grossProfitPerSalesHour: 8000,
  },
  lowSampleSalesHours: 20,
  lowSampleApproaches: 200,
  otherCostPerSalesHourJpy: 500,
  salesBaseHourlyWageJpy: 1200,
  timeBands: [
    { label: '午前 (9-11)', startHour: 9, endHour: 11 },
    { label: '昼前 (11-13)', startHour: 11, endHour: 13 },
    { label: '午後 (13-16)', startHour: 13, endHour: 16 },
    { label: '夕方 (16-19)', startHour: 16, endHour: 19 },
    { label: '夜 (19-22)', startHour: 19, endHour: 22 },
  ],
  areaScoreRankThresholds: { S: 75, A: 60, B: 45 },
};
