/**
 * 列挙値の一元定義。
 * DB は移植性のため String 列で保持し (ADR-002)、意味づけはここで行う。
 */

// ---------------------------------------------------------------- 候補者フェーズ (§6)
export const CANDIDATE_PHASES = [
  'pre_interview', // 初回面談前
  'interviewed', // 面談済み
  'jobs_proposed', // 求人提案済み
  'apply_intent', // 応募意思あり
  'document_screening', // 書類選考中
  'interview_scheduled', // 面接予定
  'post_interview', // 面接後
  'offer', // 内定
  'on_hold', // 保留
  'closed', // 終了 (入社 / 辞退 / 活動終了)
] as const;
export type CandidatePhase = (typeof CANDIDATE_PHASES)[number];

export const PHASE_LABELS: Record<CandidatePhase, string> = {
  pre_interview: '初回面談前',
  interviewed: '面談済み',
  jobs_proposed: '求人提案済み',
  apply_intent: '応募意思あり',
  document_screening: '書類選考中',
  interview_scheduled: '面接予定',
  post_interview: '面接後',
  offer: '内定',
  on_hold: '保留',
  closed: '終了',
};

/** ファネル表示順 (§24)。on_hold / closed はファネル外。 */
export const FUNNEL_PHASES: CandidatePhase[] = [
  'interviewed',
  'jobs_proposed',
  'apply_intent',
  'document_screening',
  'interview_scheduled',
  'post_interview',
  'offer',
];

// -------------------------------------------------------------------- アラート (§7)
export const ALERT_LEVELS = { NOTICE: 1, LATE: 2, CRITICAL: 3 } as const;
export type AlertLevel = 1 | 2 | 3;
export const ALERT_LEVEL_LABELS: Record<AlertLevel, string> = {
  1: '注意',
  2: '遅延',
  3: '重大',
};

export const ALERT_TYPES = [
  'interview_not_scheduled', // 面談日時未設定
  'jobs_not_proposed', // 求人未提案
  'intent_not_confirmed', // 意向未確認
  'not_recommended', // 推薦未実施
  'screening_stalled', // 書類選考が長期滞留
  'interview_prep_missing', // 面接対策未実施
  'interview_feedback_missing', // 面接所感未回収
  'offer_follow_missing', // 内定者フォロー遅延
  'hold_recontact_due', // 保留候補者の再接触期日超過
  'next_action_overdue', // 次回アクション期日超過
  'ca_no_response', // CA が AI 確認に未回答
] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  interview_not_scheduled: '面談日時未設定',
  jobs_not_proposed: '求人未提案',
  intent_not_confirmed: '求人意向未確認',
  not_recommended: '企業推薦未実施',
  screening_stalled: '書類選考が長期滞留',
  interview_prep_missing: '面接対策未実施',
  interview_feedback_missing: '面接所感未回収',
  offer_follow_missing: '内定者フォロー遅延',
  hold_recontact_due: '保留再接触期日超過',
  next_action_overdue: '次回アクション期日超過',
  ca_no_response: 'CA未回答',
};

// -------------------------------------------------------------------- 選考ステージ
export const APPLICATION_STAGES = [
  'proposed',
  'applied',
  'document_screening',
  'interview_1',
  'interview_2',
  'final',
  'offer',
  'accepted',
  'rejected',
  'withdrawn',
] as const;
export type ApplicationStage = (typeof APPLICATION_STAGES)[number];

export const APPLICATION_STAGE_LABELS: Record<ApplicationStage, string> = {
  proposed: '求人提案',
  applied: '応募',
  document_screening: '書類選考中',
  interview_1: '一次面接',
  interview_2: '二次面接',
  final: '最終面接',
  offer: '内定',
  accepted: '承諾',
  rejected: '見送り',
  withdrawn: '辞退',
};

// ------------------------------------------------------------- 見送り理由タグ (§34)
export const REJECTION_TAGS = [
  'experience_shortage', // 経験不足
  'industry_experience', // 業界経験
  'job_experience', // 職種経験
  'qualification', // 資格
  'age', // 年齢
  'job_change_count', // 転職回数
  'salary', // 年収
  'location', // 勤務地
  'education', // 学歴
  'communication', // コミュニケーション
  'motivation', // 志望動機
  'career_orientation', // キャリア志向
  'culture_fit', // カルチャーフィット
  'compared_with_others', // 他候補比較
  'other', // その他
] as const;
export type RejectionTag = (typeof REJECTION_TAGS)[number];

export const REJECTION_TAG_LABELS: Record<RejectionTag, string> = {
  experience_shortage: '経験不足',
  industry_experience: '業界経験',
  job_experience: '職種経験',
  qualification: '資格',
  age: '年齢',
  job_change_count: '転職回数',
  salary: '年収',
  location: '勤務地',
  education: '学歴',
  communication: 'コミュニケーション',
  motivation: '志望動機',
  career_orientation: 'キャリア志向',
  culture_fit: 'カルチャーフィット',
  compared_with_others: '他候補比較',
  other: 'その他',
};

// --------------------------------------------------------------------- 権限 (§49)
export const ROLES = ['admin', 'executive', 'CA', 'RA'] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABELS: Record<Role, string> = {
  admin: '管理者',
  executive: '経営者',
  CA: 'CA (候補者担当)',
  RA: 'RA (企業担当)',
};

// ------------------------------------------------------------- 営業進捗 (§29)
export const BD_STATUSES = [
  'not_started',
  'planned',
  'approached',
  'replied',
  'meeting',
  'negotiating',
  'contracted',
  'declined',
] as const;
export type BdStatus = (typeof BD_STATUSES)[number];
export const BD_STATUS_LABELS: Record<BdStatus, string> = {
  not_started: '未着手',
  planned: 'アプローチ予定',
  approached: 'アプローチ済',
  replied: '返信あり',
  meeting: '商談',
  negotiating: '契約交渉',
  contracted: '契約',
  declined: '見送り',
};

// ---------------------------------------------------------- 取引ステータス
export const TRANSACTION_STATUSES = ['existing', 'prospect', 'unknown'] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];
export const TRANSACTION_STATUS_LABELS: Record<TransactionStatus, string> = {
  existing: '既存取引',
  prospect: '開拓中',
  unknown: '未取引',
};

// ----------------------------------------------------------------- 行動種別
export const ACTION_TYPES = [
  'call',
  'mail',
  'meeting',
  'job_proposal',
  'intent_check',
  'recommend',
  'interview_prep',
  'interview_feedback',
  'offer_follow',
  'follow_up',
  'ai_check',
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];
export const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  call: '電話',
  mail: 'メール',
  meeting: '面談',
  job_proposal: '求人提案',
  intent_check: '意向確認',
  recommend: '企業推薦',
  interview_prep: '面接対策',
  interview_feedback: '面接所感回収',
  offer_follow: '内定者フォロー',
  follow_up: 'フォロー',
  ai_check: 'AI状況確認',
};

// ------------------------------------------------------ CA 回答の選択肢 (§8)
export const CA_RESPONSE_CHOICES = [
  { id: 'waiting_candidate', label: '候補者返信待ち' },
  { id: 'considering_jobs', label: '求人検討中' },
  { id: 'contacted', label: '連絡済み' },
  { id: 'will_contact', label: '連絡予定' },
  { id: 'declined_process', label: '選考辞退' },
  { id: 'paused', label: '転職活動休止' },
  { id: 'other', label: 'その他' },
] as const;

// --------------------------------------------------------------- スキル分類
export const SKILL_CATEGORIES = [
  'technical',
  'equipment',
  'software',
  'domain',
  'management',
] as const;

export const AI_CONFIDENCE = ['High', 'Medium', 'Low'] as const;
export type AiConfidence = (typeof AI_CONFIDENCE)[number];
