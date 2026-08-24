/** Display helpers. Money is stored in JPY and shown in 万円 for candidates. */

export function toManYen(value: number): number {
  return Math.round(value / 10_000);
}

export function formatManYen(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${toManYen(value).toLocaleString('ja-JP')}万円`;
}

export function formatSalaryRange(low: number | null, high: number | null): string {
  if (low === null || high === null) return '—';
  return `${toManYen(low).toLocaleString('ja-JP')}〜${toManYen(high).toLocaleString('ja-JP')}万円`;
}

export function formatYen(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `¥${Math.round(value).toLocaleString('ja-JP')}`;
}

export function formatPercent(ratio: number | null | undefined, digits = 1): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return '—';
  return `${(ratio * 100).toFixed(digits)}%`;
}

export function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toLocaleString('ja-JP', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export const VENUE_TYPE_LABELS: Record<string, string> = {
  shopping_mall: '商業施設',
  station: '駅前',
  shopping_street: '商店街',
  residential_area: '住宅地',
  park: '公園',
  supermarket: 'スーパー',
  home_center: 'ホームセンター',
  event: 'イベント',
  other: 'その他',
};

export const WEATHER_LABELS: Record<string, string> = {
  sunny: '晴れ',
  cloudy: 'くもり',
  rainy: '雨',
  snowy: '雪',
  windy: '強風',
};

export const EVENT_LABELS: Record<string, string> = {
  qr_scanned: 'QR読取',
  diagnosis_started: '診断開始',
  diagnosis_completed: '診断完了',
  lead_registered: '連絡先登録',
  interview_booked: '面談予約',
  interview_completed: '面談実施',
  candidate_qualified: '有望候補者',
  agent_recommended: 'エージェント提示',
  consent_given: '第三者提供同意',
  agent_referred: 'エージェント送客',
  agent_accepted: 'エージェント受託',
  agent_declined: 'エージェント辞退',
  agent_interview_completed: 'エージェント面談実施',
  applied: '応募',
  offer_received: '内定',
  joined: '入社',
  lost: '終了',
};

export const REFERRAL_STATUS_LABELS: Record<string, string> = {
  referred: '送客済み',
  accepted: '受託',
  declined: '辞退',
  contacted: '連絡済み',
  interview_scheduled: '面談設定',
  interview_completed: '面談実施',
  application: '応募',
  offer: '内定',
  joined: '入社',
  lost: '終了',
};

export const CANDIDATE_STATUS_LABELS: Record<string, string> = {
  anonymous: '匿名',
  diagnosed: '診断済み',
  lead: 'リード',
  interview_booked: '面談予約',
  interview_completed: '面談実施',
  qualified: '有望',
  referred: '送客済み',
  joined: '入社',
  lost: '終了',
};

export const INCENTIVE_STATUS_LABELS: Record<string, string> = {
  pending: '承認待ち',
  approved: '承認済み',
  rejected: '却下',
  paid: '支払済み',
};

/** Safe label lookup — the record index signature is optional under strict TS. */
export function labelOf(map: Record<string, string>, key: string | null | undefined): string {
  if (!key) return '—';
  return map[key] ?? key;
}

/**
 * Earliest bookable interview slot, as a `datetime-local` value.
 * Lives outside the component tree so render bodies stay pure.
 */
export function earliestInterviewSlot(hoursAhead = 24): string {
  const date = new Date(Date.now() + hoursAhead * 3_600_000);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
