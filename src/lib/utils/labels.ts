export const VENUE_TYPE_LABELS: Record<string, string> = {
  shopping_mall: "大型商業施設",
  station: "駅前",
  shopping_street: "商店街",
  residential_area: "住宅街",
  park: "公園",
  supermarket: "スーパー",
  home_center: "ホームセンター",
  event: "イベント",
  other: "その他",
};

export const WEATHER_LABELS: Record<string, string> = {
  sunny: "晴れ",
  cloudy: "曇り",
  rainy: "雨",
  snowy: "雪",
  hot: "猛暑",
  cold: "厳寒",
};

export const REFERRAL_STATUS_LABELS: Record<string, string> = {
  pending: "送客済み（未対応）",
  accepted: "受諾",
  declined: "辞退",
  contacted: "連絡済み",
  interview_scheduled: "面談設定",
  interview_completed: "面談実施",
  applied: "応募",
  offer: "内定",
  joined: "入社",
  lost: "終了",
};

export const REVENUE_EVENT_LABELS: Record<string, string> = {
  agent_accepted: "エージェント受諾",
  agent_interview_completed: "エージェント面談実施",
  offer: "内定",
  joined: "入社",
};

export const INCENTIVE_STATUS_LABELS: Record<string, string> = {
  pending: "承認待ち",
  approved: "承認済み",
  rejected: "却下",
  paid: "支払済み",
};

export const INCENTIVE_EVENT_LABELS: Record<string, string> = {
  diagnosis_completed: "診断完了",
  lead_registered: "リード登録",
  interview_booked: "面談予約",
  interview_completed: "面談実施",
  candidate_qualified: "有効候補者",
  agent_referred: "エージェント送客",
  offer: "内定",
  joined: "入社",
};

export const CANDIDATE_EVENT_LABELS: Record<string, string> = {
  qr_scanned: "QR読取",
  diagnosis_started: "診断開始",
  diagnosis_completed: "診断完了",
  lead_registered: "リード登録",
  interview_booked: "面談予約",
  interview_completed: "面談実施",
  candidate_qualified: "有効候補者",
  agent_recommended: "エージェント提示",
  consent_given: "第三者提供同意",
  agent_referred: "エージェント送客",
  agent_accepted: "エージェント受諾",
  agent_declined: "エージェント辞退",
  agent_interview_completed: "エージェント面談実施",
  applied: "応募",
  offer_received: "内定",
  joined: "入社",
  lost: "終了",
};

export const CANDIDATE_STAGE_LABELS: Record<string, string> = {
  anonymous: "匿名",
  diagnosed: "診断完了",
  lead: "リード",
  interview_booked: "面談予約",
  interview_completed: "面談実施",
  qualified: "有効候補者",
  referred: "送客済み",
  outcome: "成果",
};

export const MATCH_RANK_LABELS: Record<string, string> = {
  S: "非常に高い",
  A: "高い",
  B: "可能性あり",
  C: "限定的",
};

export const DAY_OF_WEEK_LABELS = ["日", "月", "火", "水", "木", "金", "土"] as const;

export function labelOf(map: Record<string, string>, key: string | null | undefined) {
  if (!key) return "—";
  return map[key] ?? key;
}
