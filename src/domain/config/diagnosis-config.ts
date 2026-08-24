import { z } from 'zod';

/**
 * Every number the salary diagnosis engine uses is declared here and stored in
 * `app_settings`, so operators can retune the model from /admin/diagnosis-settings
 * without a deploy. Nothing in the engine is a magic number.
 */
export const matchWeightsSchema = z.object({
  skill: z.number().min(0).max(100),
  certification: z.number().min(0).max(100),
  experience: z.number().min(0).max(100),
  location: z.number().min(0).max(100),
  workingCondition: z.number().min(0).max(100),
  educationManagement: z.number().min(0).max(100),
});

export const rankThresholdsSchema = z.object({
  S: z.number().min(0).max(100),
  A: z.number().min(0).max(100),
  B: z.number().min(0).max(100),
});

export const diagnosisConfigSchema = z.object({
  /** component weights; should sum to 100 */
  weights: matchWeightsSchema,
  /** lower bound of each rank on the 0-100 market value score */
  rankThresholds: rankThresholdsSchema,
  /** how much of the final score comes from the transition rule's base affinity (0-1) */
  transitionAffinityWeight: z.number().min(0).max(1),
  /** options scoring below this are not shown as realistic targets */
  minMatchScore: z.number().min(0).max(100),
  /** always show at least this many options even if below minMatchScore */
  minOptionsShown: z.number().int().min(1).max(10),
  /** never show more than this many options */
  maxOptionsShown: z.number().int().min(1).max(10),
  /** salary figures are rounded to this unit (JPY) before display */
  salaryRoundingUnit: z.number().int().min(1000),
  /** years above the rule minimum that count as "fully experienced" */
  experienceFullBonusYears: z.number().min(1).max(30),
  /**
   * Applied to the expected salary of an occupation the candidate has not
   * worked in. Changing field costs tenure, so the estimate is discounted.
   */
  crossOccupationDiscount: z.number().min(0.5).max(1),
  /**
   * Hard ceiling on the displayed range, as a multiple of the current salary.
   * Keeps the headline conservative even when the benchmark spread is wide.
   */
  maxUpliftMultiple: z.number().min(1).max(3),
  /** market value score = matchWeight * bestMatch + upsideWeight * upsideScore */
  marketValue: z.object({
    matchWeight: z.number().min(0).max(1),
    upsideWeight: z.number().min(0).max(1),
    /** upside (JPY) that scores 100 on the upside axis */
    upsideFullJpy: z.number().int().min(100000),
  }),
  /** 0-1 score per education level, used by the education/management component */
  educationScores: z.object({
    high_school: z.number().min(0).max(1),
    vocational: z.number().min(0).max(1),
    associate: z.number().min(0).max(1),
    bachelor: z.number().min(0).max(1),
    master: z.number().min(0).max(1),
    other: z.number().min(0).max(1),
  }),
  /** candidates at or above this market value score are flagged `qualified` */
  qualifiedMinScore: z.number().min(0).max(100),
  /** ...and must clear this expected upside (JPY) as well */
  qualifiedMinUpsideJpy: z.number().int().min(0),
});

export type MatchWeights = z.infer<typeof matchWeightsSchema>;
export type RankThresholds = z.infer<typeof rankThresholdsSchema>;
export type DiagnosisConfig = z.infer<typeof diagnosisConfigSchema>;

export const DEFAULT_DIAGNOSIS_CONFIG: DiagnosisConfig = {
  weights: {
    skill: 35,
    certification: 20,
    experience: 15,
    location: 10,
    workingCondition: 10,
    educationManagement: 10,
  },
  rankThresholds: { S: 85, A: 70, B: 55 },
  transitionAffinityWeight: 0.2,
  minMatchScore: 55,
  minOptionsShown: 3,
  maxOptionsShown: 5,
  salaryRoundingUnit: 100_000,
  experienceFullBonusYears: 5,
  crossOccupationDiscount: 0.92,
  maxUpliftMultiple: 1.6,
  marketValue: { matchWeight: 0.7, upsideWeight: 0.3, upsideFullJpy: 1_500_000 },
  educationScores: {
    high_school: 0.6,
    vocational: 0.75,
    associate: 0.8,
    bachelor: 0.9,
    master: 1,
    other: 0.6,
  },
  qualifiedMinScore: 70,
  qualifiedMinUpsideJpy: 500_000,
};

export const DIAGNOSIS_ENGINE_VERSION = '1.0.0';
