import { prisma } from '@/lib/db';
import { parseJson, toJson } from '@/lib/json';
import type { AlertType, CandidatePhase } from '@/lib/domain/enums';

/**
 * 管理画面から変更可能な設定 (§6/§9/§11/§18/§52)。
 * 既定値をコードで持ち、DB (system_settings) の値で上書きする。
 */

// ----------------------------------------------------------------- SLA 設定
export type SlaRule = {
  alertType: AlertType;
  /** 起点からの猶予時間 (h)。ここを超えると Level 2、超過前の warnRatio で Level 1。 */
  hours: number;
  /** 期限超過時のアラートレベル。 */
  level: 1 | 2 | 3;
  /** 営業日ベースで計算するか (§6「翌営業日まで」)。 */
  businessDays: boolean;
  label: string;
};

export type SlaSettings = {
  /** 期限の何割を過ぎたら Level 1 (注意) を出すか。 */
  warnRatio: number;
  rules: Record<CandidatePhase, SlaRule[]>;
};

export const DEFAULT_SLA: SlaSettings = {
  warnRatio: 0.75,
  rules: {
    pre_interview: [
      {
        alertType: 'interview_not_scheduled',
        hours: 24,
        level: 2,
        businessDays: false,
        label: '面談希望取得から24時間以内に日時設定',
      },
    ],
    interviewed: [
      {
        alertType: 'jobs_not_proposed',
        hours: 24,
        level: 2,
        businessDays: false,
        label: '面談後24時間以内に求人提案',
      },
    ],
    jobs_proposed: [
      {
        alertType: 'intent_not_confirmed',
        hours: 48,
        level: 2,
        businessDays: false,
        label: '求人提案後48時間以内に意向確認',
      },
    ],
    apply_intent: [
      {
        alertType: 'not_recommended',
        hours: 24,
        level: 3,
        businessDays: true,
        label: '応募意思確認後、翌営業日までに企業推薦',
      },
    ],
    document_screening: [
      {
        alertType: 'screening_stalled',
        hours: 168,
        level: 2,
        businessDays: false,
        label: '書類提出から7日で企業回答を確認',
      },
    ],
    interview_scheduled: [
      {
        alertType: 'interview_prep_missing',
        hours: 48,
        level: 3,
        businessDays: false,
        label: '面接48時間前までに面接対策を実施',
      },
    ],
    post_interview: [
      {
        alertType: 'interview_feedback_missing',
        hours: 24,
        level: 2,
        businessDays: false,
        label: '面接当日〜翌日までに候補者所感を取得',
      },
    ],
    offer: [
      {
        alertType: 'offer_follow_missing',
        hours: 24,
        level: 3,
        businessDays: false,
        label: '内定後は24時間ごとにフォロー (最重要)',
      },
    ],
    on_hold: [
      {
        alertType: 'hold_recontact_due',
        hours: 0,
        level: 2,
        businessDays: false,
        label: '次回接触予定日を超過',
      },
    ],
    closed: [],
  },
};

// --------------------------------------------------------- マッチング重み (§11)
export type MatchWeights = {
  jobCategory: number;
  requiredSkills: number;
  industry: number;
  qualification: number;
  location: number;
  salary: number;
  desiredWork: number;
  other: number;
};

export const DEFAULT_MATCH_WEIGHTS: MatchWeights = {
  jobCategory: 25,
  requiredSkills: 20,
  industry: 10,
  qualification: 10,
  location: 10,
  salary: 10,
  desiredWork: 10,
  other: 5,
};

export const MATCH_WEIGHT_LABELS: Record<keyof MatchWeights, string> = {
  jobCategory: '経験職種',
  requiredSkills: '必須スキル',
  industry: '業界経験',
  qualification: '資格',
  location: '勤務地',
  salary: '年収',
  desiredWork: '希望仕事内容',
  other: 'その他',
};

// ------------------------------------------------ 新規開拓スコア重み (§18)
export type BdWeights = {
  candidateFit: number;
  hiringDemand: number;
  poolAffinity: number;
  focusArea: number;
  continuity: number;
  hiringVolume: number;
  estimatedFee: number;
};

export const DEFAULT_BD_WEIGHTS: BdWeights = {
  candidateFit: 30,
  hiringDemand: 25,
  poolAffinity: 15,
  focusArea: 10,
  continuity: 10,
  hiringVolume: 5,
  estimatedFee: 5,
};

export const BD_WEIGHT_LABELS: Record<keyof BdWeights, string> = {
  candidateFit: '候補者適合度',
  hiringDemand: '現在の採用需要',
  poolAffinity: '保有候補者との相性',
  focusArea: '当社重点領域との相性',
  continuity: '継続的な求人可能性',
  hiringVolume: '採用規模',
  estimatedFee: '推定紹介フィー',
};

// ------------------------------------------------------- エスカレーション (§9)
export type EscalationSettings = {
  /** 1 回目の AI 確認から再通知までの時間 (h)。 */
  firstReminderHours: number;
  /** 再通知から経営者エスカレーションまでの時間 (h)。 */
  escalationHours: number;
  /** Level 3 を経営者へ即時通知するか。 */
  notifyExecutiveOnCritical: boolean;
};

export const DEFAULT_ESCALATION: EscalationSettings = {
  firstReminderHours: 12,
  escalationHours: 24,
  notifyExecutiveOnCritical: true,
};

// ------------------------------------------------------------ 定期実行 (§52)
export type ScheduleSettings = {
  morningMonitor: string; // HH:mm 候補者監視
  eveningRecheck: string; // 未対応再確認
  executiveReport: string; // 日次レポート
  weeklyMarketResearch: string; // 曜日:HH:mm
  weeklyBdRanking: string;
};

export const DEFAULT_SCHEDULE: ScheduleSettings = {
  morningMonitor: '08:30',
  eveningRecheck: '17:30',
  executiveReport: '19:00',
  weeklyMarketResearch: 'MON:07:00',
  weeklyBdRanking: 'MON:08:00',
};

// -------------------------------------------------------------- 重点領域 (§1)
export const DEFAULT_FOCUS_AREAS = [
  '施工管理',
  'プラントエンジニア',
  'サービスエンジニア',
  '設備保全',
  '生産技術',
  '建築設計',
  '電気設備',
  '機械設備',
  'ファシリティマネジメント',
  'データセンター',
];

// --------------------------------------------------------------- アクセサ
export const SETTING_KEYS = {
  sla: 'sla',
  matchWeights: 'match_weights',
  bdWeights: 'bd_weights',
  escalation: 'escalation',
  schedule: 'schedule',
  focusAreas: 'focus_areas',
} as const;

const DEFAULTS: Record<string, unknown> = {
  [SETTING_KEYS.sla]: DEFAULT_SLA,
  [SETTING_KEYS.matchWeights]: DEFAULT_MATCH_WEIGHTS,
  [SETTING_KEYS.bdWeights]: DEFAULT_BD_WEIGHTS,
  [SETTING_KEYS.escalation]: DEFAULT_ESCALATION,
  [SETTING_KEYS.schedule]: DEFAULT_SCHEDULE,
  [SETTING_KEYS.focusAreas]: DEFAULT_FOCUS_AREAS,
};

export async function getSetting<T>(key: string): Promise<T> {
  const row = await prisma.systemSetting.findUnique({ where: { key } });
  const fallback = DEFAULTS[key] as T;
  if (!row) return fallback;
  return parseJson<T>(row.value, fallback);
}

export async function setSetting(key: string, value: unknown, updatedBy?: string) {
  return prisma.systemSetting.upsert({
    where: { key },
    create: { key, value: toJson(value), updatedBy },
    update: { value: toJson(value), updatedBy },
  });
}

export const getSlaSettings = () => getSetting<SlaSettings>(SETTING_KEYS.sla);
export const getMatchWeights = () => getSetting<MatchWeights>(SETTING_KEYS.matchWeights);
export const getBdWeights = () => getSetting<BdWeights>(SETTING_KEYS.bdWeights);
export const getEscalationSettings = () => getSetting<EscalationSettings>(SETTING_KEYS.escalation);
export const getScheduleSettings = () => getSetting<ScheduleSettings>(SETTING_KEYS.schedule);
export const getFocusAreas = () => getSetting<string[]>(SETTING_KEYS.focusAreas);
