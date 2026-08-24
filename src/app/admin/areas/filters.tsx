import { VENUE_TYPE_LABELS, WEATHER_LABELS } from '@/lib/format';
import { DAY_LABELS } from '@/domain/analytics/time-bands';

/** Plain GET form — filters stay in the URL so views are shareable. */
export function AreaFilters({
  query,
  prefectures,
  timeBands,
  salesUsers,
}: {
  query: Record<string, string | undefined>;
  prefectures: string[];
  timeBands: string[];
  salesUsers: { id: string; name: string }[];
}) {
  const selectClass =
    'rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-ink-700 focus:border-brand-500 focus:outline-none';

  return (
    <form action="/admin/areas" className="flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200 bg-white p-4">
      {query.range && <input type="hidden" name="range" value={query.range} />}
      {query.from && <input type="hidden" name="from" value={query.from} />}
      {query.to && <input type="hidden" name="to" value={query.to} />}

      <label className="text-xs text-ink-500">
        都道府県
        <select name="prefecture" defaultValue={query.prefecture ?? ''} className={`mt-1 block ${selectClass}`}>
          <option value="">すべて</option>
          {prefectures.map((prefecture) => (
            <option key={prefecture} value={prefecture}>
              {prefecture}
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs text-ink-500">
        場所カテゴリ
        <select name="venueType" defaultValue={query.venueType ?? ''} className={`mt-1 block ${selectClass}`}>
          <option value="">すべて</option>
          {Object.entries(VENUE_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs text-ink-500">
        曜日
        <select name="dayOfWeek" defaultValue={query.dayOfWeek ?? ''} className={`mt-1 block ${selectClass}`}>
          <option value="">すべて</option>
          {DAY_LABELS.map((label, index) => (
            <option key={label} value={index}>
              {label}曜日
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs text-ink-500">
        時間帯
        <select name="timeBand" defaultValue={query.timeBand ?? ''} className={`mt-1 block ${selectClass}`}>
          <option value="">すべて</option>
          {timeBands.map((band) => (
            <option key={band} value={band}>
              {band}
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs text-ink-500">
        天候
        <select name="weather" defaultValue={query.weather ?? ''} className={`mt-1 block ${selectClass}`}>
          <option value="">すべて</option>
          {Object.entries(WEATHER_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs text-ink-500">
        営業担当
        <select name="salesUserId" defaultValue={query.salesUserId ?? ''} className={`mt-1 block ${selectClass}`}>
          <option value="">すべて</option>
          {salesUsers.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
      </label>

      <button
        type="submit"
        className="rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-brand-700"
      >
        絞り込む
      </button>
      <a href="/admin/areas" className="rounded-lg px-3 py-2 text-xs text-ink-500 hover:bg-slate-100">
        リセット
      </a>
    </form>
  );
}
