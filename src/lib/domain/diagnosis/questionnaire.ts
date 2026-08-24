import { z } from "zod";
import { EDUCATION_LEVELS, EMPLOYMENT_TYPES } from "./types";

/* -------------------------------------------------------------------------- */
/* Banded answers                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Salary is asked as a band, never as an exact figure: it lowers drop-off on a
 * street-side form and the engine only needs a representative value.
 */
export const SALARY_BANDS = [
  { value: "lt300", label: "300万円未満", midpointYen: 2_600_000 },
  { value: "300_350", label: "300〜350万円", midpointYen: 3_250_000 },
  { value: "350_400", label: "350〜400万円", midpointYen: 3_750_000 },
  { value: "400_450", label: "400〜450万円", midpointYen: 4_250_000 },
  { value: "450_500", label: "450〜500万円", midpointYen: 4_750_000 },
  { value: "500_600", label: "500〜600万円", midpointYen: 5_500_000 },
  { value: "600_700", label: "600〜700万円", midpointYen: 6_500_000 },
  { value: "700_800", label: "700〜800万円", midpointYen: 7_500_000 },
  { value: "800_1000", label: "800〜1000万円", midpointYen: 9_000_000 },
  { value: "gte1000", label: "1000万円以上", midpointYen: 11_000_000 },
] as const;

export const EXPERIENCE_OPTIONS = [
  { value: "0-2", label: "3年未満", years: 1 },
  { value: "3-5", label: "3〜5年", years: 4 },
  { value: "6-9", label: "6〜9年", years: 7 },
  { value: "10-14", label: "10〜14年", years: 12 },
  { value: "15+", label: "15年以上", years: 18 },
] as const;

export const MANAGEMENT_OPTIONS = [
  { value: "none", label: "なし", years: 0 },
  { value: "1_2", label: "1〜2年", years: 2 },
  { value: "3_5", label: "3〜5年", years: 4 },
  { value: "6plus", label: "6年以上", years: 8 },
] as const;

export const EMPLOYMENT_TYPE_OPTIONS = [
  { value: "full_time", label: "正社員" },
  { value: "contract", label: "契約社員" },
  { value: "dispatch", label: "派遣社員" },
  { value: "part_time", label: "パート・アルバイト" },
  { value: "self_employed", label: "個人事業主・業務委託" },
  { value: "other", label: "その他" },
] as const;

export const INDUSTRY_OPTIONS = [
  { value: "automotive", label: "自動車・輸送機器" },
  { value: "manufacturing", label: "製造・機械" },
  { value: "construction", label: "建設・設備" },
  { value: "energy", label: "電気・エネルギー" },
  { value: "logistics", label: "物流・運輸" },
  { value: "retail", label: "小売・流通" },
  { value: "it", label: "IT・通信" },
  { value: "service", label: "サービス" },
  { value: "medical", label: "医療・介護" },
  { value: "other", label: "その他" },
] as const;

export const EDUCATION_OPTIONS = [
  { value: "high_school", label: "高校卒" },
  { value: "vocational", label: "専門学校卒" },
  { value: "associate", label: "短大・高専卒" },
  { value: "bachelor", label: "大学卒" },
  { value: "master", label: "大学院卒（修士）" },
  { value: "doctorate", label: "大学院卒（博士）" },
  { value: "other", label: "その他" },
] as const;

export const DESIRED_CONDITION_OPTIONS = [
  { value: "salary_up", label: "年収を上げたい" },
  { value: "work_life", label: "休日・残業を改善したい" },
  { value: "commute", label: "通勤を短くしたい" },
  { value: "stability", label: "安定した会社で働きたい" },
  { value: "skill_up", label: "スキルを伸ばしたい" },
  { value: "no_night_shift", label: "夜勤を避けたい" },
  { value: "management", label: "マネジメントに挑戦したい" },
] as const;

export const DESIRED_TIMING_OPTIONS = [
  { value: "asap", label: "すぐにでも" },
  { value: "1_3m", label: "1〜3ヶ月以内" },
  { value: "3_6m", label: "3〜6ヶ月以内" },
  { value: "6_12m", label: "6〜12ヶ月以内" },
  { value: "undecided", label: "まだ決めていない" },
] as const;

/* -------------------------------------------------------------------------- */
/* Question flow (one question per screen)                                    */
/* -------------------------------------------------------------------------- */

export type QuestionKind = "single" | "multi" | "boolean";

/** Options for these come from master tables, not from this file. */
export type DynamicOptionSource = "occupations" | "skills" | "certifications" | "regions";

export interface DiagnosisQuestion {
  id: keyof DiagnosisAnswers;
  title: string;
  help?: string;
  kind: QuestionKind;
  options?: readonly { value: string; label: string }[];
  source?: DynamicOptionSource;
  /** Multi-select questions may legitimately be left empty. */
  allowEmpty?: boolean;
}

export const DIAGNOSIS_QUESTIONS: readonly DiagnosisQuestion[] = [
  {
    id: "currentSalaryBand",
    title: "現在の年収を教えてください",
    help: "おおよそで大丈夫です。手取りではなく額面でお答えください。",
    kind: "single",
    options: SALARY_BANDS.map(({ value, label }) => ({ value, label })),
  },
  {
    id: "currentOccupationId",
    title: "現在のお仕事に近いものはどれですか",
    kind: "single",
    source: "occupations",
  },
  {
    id: "currentIndustry",
    title: "現在の業界を教えてください",
    kind: "single",
    options: INDUSTRY_OPTIONS,
  },
  {
    id: "experienceBand",
    title: "その仕事の経験年数はどれくらいですか",
    kind: "single",
    options: EXPERIENCE_OPTIONS.map(({ value, label }) => ({ value, label })),
  },
  {
    id: "skillIds",
    title: "当てはまる経験をすべて選んでください",
    help: "市場価値の評価に使われます。",
    kind: "multi",
    source: "skills",
    allowEmpty: true,
  },
  {
    id: "certificationIds",
    title: "お持ちの資格をすべて選んでください",
    kind: "multi",
    source: "certifications",
    allowEmpty: true,
  },
  {
    id: "managementBand",
    title: "マネジメント経験はありますか",
    kind: "single",
    options: MANAGEMENT_OPTIONS.map(({ value, label }) => ({ value, label })),
  },
  {
    id: "employmentType",
    title: "現在の雇用形態を教えてください",
    kind: "single",
    options: EMPLOYMENT_TYPE_OPTIONS,
  },
  {
    id: "currentRegionId",
    title: "現在の勤務地を教えてください",
    kind: "single",
    source: "regions",
  },
  {
    id: "desiredRegionIds",
    title: "希望の勤務地を選んでください",
    help: "複数選べます。",
    kind: "multi",
    source: "regions",
    allowEmpty: true,
  },
  {
    id: "relocationOk",
    title: "転勤は可能ですか",
    kind: "boolean",
  },
  {
    id: "travelOk",
    title: "出張は可能ですか",
    kind: "boolean",
  },
  {
    id: "nightShiftOk",
    title: "夜勤は可能ですか",
    kind: "boolean",
  },
  {
    id: "educationLevel",
    title: "最終学歴を教えてください",
    kind: "single",
    options: EDUCATION_OPTIONS,
  },
  {
    id: "desiredConditions",
    title: "転職で重視したい条件を選んでください",
    help: "複数選べます。",
    kind: "multi",
    options: DESIRED_CONDITION_OPTIONS,
    allowEmpty: true,
  },
  {
    id: "desiredTiming",
    title: "転職を考えている時期はいつ頃ですか",
    kind: "single",
    options: DESIRED_TIMING_OPTIONS,
  },
];

/* -------------------------------------------------------------------------- */
/* Answer payload                                                             */
/* -------------------------------------------------------------------------- */

function values<T extends readonly { value: string }[]>(options: T): [string, ...string[]] {
  return options.map((option) => option.value) as unknown as [string, ...string[]];
}

export const diagnosisAnswersSchema = z.object({
  currentSalaryBand: z.enum(values(SALARY_BANDS)),
  currentOccupationId: z.coerce.number().int().positive(),
  currentIndustry: z.enum(values(INDUSTRY_OPTIONS)),
  experienceBand: z.enum(values(EXPERIENCE_OPTIONS)),
  skillIds: z.array(z.coerce.number().int().positive()),
  certificationIds: z.array(z.coerce.number().int().positive()),
  managementBand: z.enum(values(MANAGEMENT_OPTIONS)),
  employmentType: z.enum(EMPLOYMENT_TYPES as unknown as [string, ...string[]]),
  currentRegionId: z.coerce.number().int().positive(),
  desiredRegionIds: z.array(z.coerce.number().int().positive()),
  relocationOk: z.boolean(),
  travelOk: z.boolean(),
  nightShiftOk: z.boolean(),
  educationLevel: z.enum(EDUCATION_LEVELS as unknown as [string, ...string[]]),
  desiredConditions: z.array(z.enum(values(DESIRED_CONDITION_OPTIONS))),
  desiredTiming: z.enum(values(DESIRED_TIMING_OPTIONS)),
});

export type DiagnosisAnswers = z.infer<typeof diagnosisAnswersSchema>;

export function salaryFromBand(band: string): number {
  return SALARY_BANDS.find((option) => option.value === band)?.midpointYen ?? 4_000_000;
}

export function yearsFromExperienceBand(band: string): number {
  return EXPERIENCE_OPTIONS.find((option) => option.value === band)?.years ?? 1;
}

export function yearsFromManagementBand(band: string): number {
  return MANAGEMENT_OPTIONS.find((option) => option.value === band)?.years ?? 0;
}

export function labelFor(
  options: readonly { value: string; label: string }[],
  value: string | undefined,
): string {
  return options.find((option) => option.value === value)?.label ?? "—";
}
