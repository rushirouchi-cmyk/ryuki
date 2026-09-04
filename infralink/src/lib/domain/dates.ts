/** 期日計算。SLA の「翌営業日まで」を表現するため営業日計算を持つ (§6)。 */

const MS_PER_HOUR = 3600_000;

/** 土日を営業日から除外する。祝日カレンダーは Phase 2 で設定化する想定 (DECISIONS ADR-006)。 */
export function isBusinessDay(date: Date) {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

/** from から n 営業日後の同時刻。n=1 なら「翌営業日」。 */
export function addBusinessDays(from: Date, n: number) {
  const result = new Date(from);
  let remaining = Math.max(0, Math.round(n));
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    if (isBusinessDay(result)) remaining -= 1;
  }
  return result;
}

export function addHours(from: Date, hours: number) {
  return new Date(from.getTime() + hours * MS_PER_HOUR);
}

export function hoursBetween(a: Date, b: Date) {
  return (b.getTime() - a.getTime()) / MS_PER_HOUR;
}

export function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function daysBetween(a: Date, b: Date) {
  return Math.floor((startOfDay(b).getTime() - startOfDay(a).getTime()) / (24 * MS_PER_HOUR));
}

const JST = 'ja-JP';

export function formatDate(date: Date | string | null | undefined) {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(JST, { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function formatDateTime(date: Date | string | null | undefined) {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(JST, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 「2日超過」「本日」「あと3日」のような相対表現。 */
export function describeDue(due: Date | null | undefined, now = new Date()) {
  if (!due) return { label: '期日なし', overdueDays: 0, overdue: false };
  const diff = daysBetween(now, due);
  if (diff < 0) return { label: `期限超過 ${Math.abs(diff)}日`, overdueDays: Math.abs(diff), overdue: true };
  if (diff === 0) return { label: '本日', overdueDays: 0, overdue: false };
  return { label: `あと${diff}日`, overdueDays: 0, overdue: false };
}

export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
