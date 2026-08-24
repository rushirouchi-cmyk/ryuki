import { z } from 'zod';

/** Salary bands offered in the questionnaire (JPY). midpoint is used by the engine. */
export const SALARY_BANDS = [
  { value: 'under_300', label: '300万円未満', midpoint: 2_600_000 },
  { value: '300_349', label: '300〜349万円', midpoint: 3_250_000 },
  { value: '350_399', label: '350〜399万円', midpoint: 3_750_000 },
  { value: '400_449', label: '400〜449万円', midpoint: 4_250_000 },
  { value: '450_499', label: '450〜499万円', midpoint: 4_750_000 },
  { value: '500_599', label: '500〜599万円', midpoint: 5_500_000 },
  { value: '600_699', label: '600〜699万円', midpoint: 6_500_000 },
  { value: '700_799', label: '700〜799万円', midpoint: 7_500_000 },
  { value: 'over_800', label: '800万円以上', midpoint: 9_000_000 },
] as const;

export type SalaryBandValue = (typeof SALARY_BANDS)[number]['value'];

export const EXPERIENCE_OPTIONS = [
  { value: 1, label: '1年未満〜2年' },
  { value: 4, label: '3〜5年' },
  { value: 7, label: '6〜9年' },
  { value: 12, label: '10〜14年' },
  { value: 18, label: '15年以上' },
] as const;

export const AGE_BANDS = ['20代前半', '20代後半', '30代前半', '30代後半', '40代', '50代以上'] as const;

export const JOB_CHANGE_TIMINGS = [
  '1ヶ月以内',
  '1〜3ヶ月',
  '3〜6ヶ月',
  '半年以上先',
  '良い求人があれば',
] as const;

export const INDUSTRIES = [
  '自動車・輸送機器',
  '機械・電機',
  '建設・設備',
  '製造その他',
  '物流・運輸',
  '小売・サービス',
  'IT・通信',
  'その他',
] as const;

export const EMPLOYMENT_TYPES = [
  { value: 'full_time', label: '正社員' },
  { value: 'contract', label: '契約社員' },
  { value: 'dispatch', label: '派遣社員' },
  { value: 'part_time', label: 'アルバイト・パート' },
  { value: 'freelance', label: '個人事業主' },
  { value: 'unemployed', label: '現在離職中' },
] as const;

export const EDUCATION_LEVELS = [
  { value: 'high_school', label: '高校卒' },
  { value: 'vocational', label: '専門学校卒' },
  { value: 'associate', label: '短大・高専卒' },
  { value: 'bachelor', label: '大学卒' },
  { value: 'master', label: '大学院卒' },
  { value: 'other', label: 'その他' },
] as const;

export const DESIRED_CONDITIONS = [
  '年収アップ',
  '土日休み',
  '残業が少ない',
  '転勤なし',
  '資格を活かせる',
  '未経験でも挑戦できる',
  '福利厚生',
  '通勤時間が短い',
] as const;

export const PREFECTURES = [
  '北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県',
  '埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県',
  '岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県',
  '鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県',
  '佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県',
] as const;

/** Prefectures offered as quick chips on the "希望勤務地" step. */
export const NEARBY_PREFECTURES = ['大阪府', '兵庫県', '京都府', '滋賀県', '奈良県', '和歌山県'] as const;

export const diagnosisAnswersSchema = z.object({
  salaryBand: z.enum(SALARY_BANDS.map((b) => b.value) as [SalaryBandValue, ...SalaryBandValue[]]),
  occupationId: z.string().uuid('現在の職種を選択してください'),
  industry: z.enum(INDUSTRIES),
  experienceYears: z.number().int().min(0).max(60),
  certificationIds: z.array(z.string().uuid()).max(20),
  skillIds: z.array(z.string().uuid()).max(40),
  hasManagementExperience: z.boolean(),
  employmentType: z.enum(EMPLOYMENT_TYPES.map((e) => e.value) as [string, ...string[]]),
  currentPrefecture: z.string().min(1, '現在の勤務地を選択してください'),
  desiredPrefectures: z.array(z.string().min(1)).min(1, '希望勤務地を1つ以上選択してください').max(5),
  relocationOk: z.boolean(),
  businessTripOk: z.boolean(),
  nightShiftOk: z.boolean(),
  educationLevel: z.enum(EDUCATION_LEVELS.map((e) => e.value) as [string, ...string[]]),
  desiredConditions: z.array(z.enum(DESIRED_CONDITIONS)).max(8),
  ageBand: z.enum(AGE_BANDS),
  jobChangeTiming: z.enum(JOB_CHANGE_TIMINGS),
});

export type DiagnosisAnswers = z.infer<typeof diagnosisAnswersSchema>;

export function salaryFromBand(band: SalaryBandValue): number {
  return SALARY_BANDS.find((b) => b.value === band)?.midpoint ?? 4_000_000;
}

export const leadRegistrationSchema = z.object({
  fullName: z.string().min(1, 'お名前を入力してください').max(80),
  email: z.string().email('メールアドレスの形式が正しくありません'),
  phone: z
    .string()
    .min(10, '電話番号を入力してください')
    .max(20)
    .regex(/^[0-9+\-() ]+$/, '電話番号の形式が正しくありません'),
  birthYear: z.number().int().min(1940).max(2010).optional(),
  privacyAgreed: z.literal(true, { errorMap: () => ({ message: '個人情報の取扱いに同意してください' }) }),
});

export type LeadRegistration = z.infer<typeof leadRegistrationSchema>;
