import { z } from "zod";

/**
 * Every tunable business rule is stored in `app_settings` and edited from the
 * admin UI. Defaults below are only the bootstrap values written by the seed.
 */
export const SETTING_KEYS = {
  diagnosis: "diagnosis.config",
  areaScore: "analytics.area_score",
  agentMatching: "agents.matching",
  consent: "consent.template",
  qualification: "candidate.qualification",
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

/* -------------------------------------------------------------------------- */
/* Diagnosis engine configuration                                             */
/* -------------------------------------------------------------------------- */

export const diagnosisConfigSchema = z.object({
  /** Bumped whenever scoring semantics change, stored on every diagnosis. */
  engineVersion: z.string(),
  /** Component weights; must sum to 100. */
  weights: z.object({
    skill: z.number().min(0).max(100),
    certification: z.number().min(0).max(100),
    experience: z.number().min(0).max(100),
    location: z.number().min(0).max(100),
    workingCondition: z.number().min(0).max(100),
    profile: z.number().min(0).max(100),
  }),
  /** Lower bound of each rank; anything below `B` is `C`. */
  rankThresholds: z.object({
    S: z.number().min(0).max(100),
    A: z.number().min(0).max(100),
    B: z.number().min(0).max(100),
  }),
  /** Occupations scoring below this are not offered as career options. */
  minMatchScore: z.number().min(0).max(100),
  /** How many career options are shown to the candidate. */
  maxCareerOptions: z.number().int().min(1).max(10),
  /** How many options feed the estimated salary range. */
  salaryOptionCount: z.number().int().min(1).max(10),
  /** Display rounding for every salary figure, in JPY (100_000 = 10万円). */
  salaryRoundingUnit: z.number().int().min(1000),
  /** Score used for a component that has no reference data at all. */
  neutralComponentScore: z.number().min(0).max(1),
  /** Years of experience at which the experience component saturates. */
  experienceSaturationYears: z.number().min(1).max(40),
  /** Points removed per unmet required skill / certification. */
  requirementPenalty: z.number().min(0).max(100),
  /** Floor of the transition-plausibility multiplier (0.6 => 60%..100%). */
  transitionFactorFloor: z.number().min(0).max(1),
  /** Years of management experience at which the management sub-score maxes. */
  managementSaturationYears: z.number().min(1).max(20),
  /** How many "valued experiences" to surface on the result screen. */
  valuedExperienceCount: z.number().int().min(1).max(10),
  /**
   * Ceiling on the projected range as a multiple of the current salary. Sparse
   * benchmark data can otherwise imply a 2-3x jump, which is not a claim this
   * product should make to someone on a street corner.
   */
  maxUpliftFactor: z.number().min(1).max(5),
});

export type DiagnosisConfig = z.infer<typeof diagnosisConfigSchema>;

export const DEFAULT_DIAGNOSIS_CONFIG: DiagnosisConfig = {
  engineVersion: "1.0.0",
  weights: {
    skill: 35,
    certification: 20,
    experience: 15,
    location: 10,
    workingCondition: 10,
    profile: 10,
  },
  rankThresholds: { S: 85, A: 70, B: 55 },
  minMatchScore: 55,
  maxCareerOptions: 3,
  salaryOptionCount: 3,
  salaryRoundingUnit: 100_000,
  neutralComponentScore: 0.6,
  experienceSaturationYears: 5,
  requirementPenalty: 12,
  transitionFactorFloor: 0.75,
  managementSaturationYears: 3,
  valuedExperienceCount: 4,
  maxUpliftFactor: 1.8,
};

/* -------------------------------------------------------------------------- */
/* Area score configuration                                                   */
/* -------------------------------------------------------------------------- */

export const areaScoreMetricKeys = [
  "approachesPerHour",
  "stopRate",
  "scanRate",
  "diagnosisCompletionRate",
  "leadRate",
  "interviewBookingRate",
  "interviewAttendanceRate",
  "qualifiedRate",
  "referralRate",
  "revenuePerLead",
  "revenuePerSalesHour",
  "grossProfitPerSalesHour",
] as const;

export type AreaScoreMetricKey = (typeof areaScoreMetricKeys)[number];

export const areaScoreConfigSchema = z.object({
  /**
   * Weight per metric; the score is a weighted percentile against peers.
   * Omitted metrics are simply not scored, so an operator can narrow the
   * score down to the handful of numbers they actually steer by.
   */
  weights: z.partialRecord(z.enum(areaScoreMetricKeys), z.number().min(0)),
  /** Below this many sales hours the score is shown as "insufficient data". */
  minSalesHours: z.number().min(0),
  /** Below this many approaches the score is shown as "insufficient data". */
  minApproaches: z.number().min(0),
  rankThresholds: z.object({
    S: z.number().min(0).max(100),
    A: z.number().min(0).max(100),
    B: z.number().min(0).max(100),
  }),
});

export type AreaScoreConfig = z.infer<typeof areaScoreConfigSchema>;

export const DEFAULT_AREA_SCORE_CONFIG: AreaScoreConfig = {
  weights: {
    approachesPerHour: 5,
    stopRate: 10,
    scanRate: 10,
    diagnosisCompletionRate: 10,
    leadRate: 15,
    interviewBookingRate: 5,
    interviewAttendanceRate: 5,
    qualifiedRate: 10,
    referralRate: 5,
    revenuePerLead: 5,
    revenuePerSalesHour: 10,
    grossProfitPerSalesHour: 20,
  },
  minSalesHours: 20,
  minApproaches: 200,
  rankThresholds: { S: 80, A: 65, B: 50 },
};

/* -------------------------------------------------------------------------- */
/* Agent matching configuration                                               */
/* -------------------------------------------------------------------------- */

export const agentMatchingConfigSchema = z.object({
  weights: z.object({
    specialty: z.number().min(0),
    region: z.number().min(0),
    salaryBand: z.number().min(0),
    careerStage: z.number().min(0),
    historicalPerformance: z.number().min(0),
  }),
  /** Maximum agencies shown to the candidate. */
  maxRecommendations: z.number().int().min(1).max(5),
  /** Placement rate assumed for an agency with no history yet. */
  neutralPerformance: z.number().min(0).max(1),
  /** Referrals needed before an agency's own history is trusted. */
  performanceSampleFloor: z.number().int().min(1),
});

export type AgentMatchingConfig = z.infer<typeof agentMatchingConfigSchema>;

export const DEFAULT_AGENT_MATCHING_CONFIG: AgentMatchingConfig = {
  weights: {
    specialty: 40,
    region: 20,
    salaryBand: 15,
    careerStage: 10,
    historicalPerformance: 15,
  },
  maxRecommendations: 5,
  neutralPerformance: 0.35,
  performanceSampleFloor: 10,
};

/* -------------------------------------------------------------------------- */
/* Qualification & consent                                                    */
/* -------------------------------------------------------------------------- */

export const qualificationConfigSchema = z.object({
  /** A candidate is "qualified" once these hold after the career interview. */
  minMatchRank: z.enum(["S", "A", "B", "C"]),
  requireContact: z.boolean(),
  requireInterviewCompleted: z.boolean(),
});

export type QualificationConfig = z.infer<typeof qualificationConfigSchema>;

export const DEFAULT_QUALIFICATION_CONFIG: QualificationConfig = {
  minMatchRank: "B",
  requireContact: true,
  requireInterviewCompleted: true,
};

export const consentConfigSchema = z.object({
  version: z.string(),
  scope: z.string(),
  text: z.string(),
});

export type ConsentConfig = z.infer<typeof consentConfigSchema>;

export const DEFAULT_CONSENT_CONFIG: ConsentConfig = {
  version: "2026-01-v1",
  scope: "name,email,phone,diagnosis_result,desired_conditions",
  text: [
    "【第三者提供に関する同意】",
    "あなたが選択した転職エージェントに対し、以下の情報を提供します。",
    "・氏名 / メールアドレス / 電話番号",
    "・年収診断の結果（現在年収帯・想定年収レンジ・市場価値ランク・推奨職種）",
    "・希望勤務地 / 希望条件 / 転職希望時期",
    "提供先はあなたが選択したエージェントのみです。選択していないエージェントには提供されません。",
    "同意はいつでも撤回できます（撤回後の提供は停止されますが、提供済みの情報には及びません）。",
    "※本文はMVP用のプレースホルダーです。正式版は個人情報保護方針に準拠した文面に差し替えてください。",
  ].join("\n"),
};

export const DEFAULT_SETTINGS: { key: SettingKey; value: unknown; description: string }[] =
  [
    {
      key: SETTING_KEYS.diagnosis,
      value: DEFAULT_DIAGNOSIS_CONFIG,
      description: "年収診断エンジンの重み・しきい値・丸め単位",
    },
    {
      key: SETTING_KEYS.areaScore,
      value: DEFAULT_AREA_SCORE_CONFIG,
      description: "エリアスコアの指標重みと最小サンプル条件",
    },
    {
      key: SETTING_KEYS.agentMatching,
      value: DEFAULT_AGENT_MATCHING_CONFIG,
      description: "エージェント推薦スコアの重み",
    },
    {
      key: SETTING_KEYS.qualification,
      value: DEFAULT_QUALIFICATION_CONFIG,
      description: "有効候補者(Qualified)の判定条件",
    },
    {
      key: SETTING_KEYS.consent,
      value: DEFAULT_CONSENT_CONFIG,
      description: "第三者提供同意の文面とバージョン",
    },
  ];
