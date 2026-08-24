import Link from 'next/link';
import clsx from 'clsx';
import { buildQuery, RANGE_OPTIONS, type Period } from '@/lib/period';

export function PeriodFilter({
  period,
  basePath,
  query,
}: {
  period: Period;
  basePath: string;
  query: Record<string, string | undefined>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {RANGE_OPTIONS.map((option) => (
        <Link
          key={option.key}
          href={`${basePath}${buildQuery(query, { range: option.key, from: undefined, to: undefined })}`}
          className={clsx(
            'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
            period.key === option.key
              ? 'border-brand-600 bg-brand-600 text-white'
              : 'border-slate-300 bg-white text-ink-700 hover:bg-slate-50',
          )}
        >
          {option.label}
        </Link>
      ))}
      <form action={basePath} className="flex items-center gap-1.5">
        {Object.entries(query)
          .filter(([key]) => key !== 'from' && key !== 'to' && key !== 'range')
          .map(([key, value]) =>
            value ? <input key={key} type="hidden" name={key} value={value} /> : null,
          )}
        <input
          type="date"
          name="from"
          defaultValue={period.key === 'custom' ? period.from.toISOString().slice(0, 10) : ''}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          aria-label="開始日"
        />
        <span className="text-xs text-ink-500">〜</span>
        <input
          type="date"
          name="to"
          defaultValue={
            period.key === 'custom'
              ? new Date(period.to.getTime() - 86_400_000).toISOString().slice(0, 10)
              : ''
          }
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          aria-label="終了日"
        />
        <button
          type="submit"
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-slate-50"
        >
          適用
        </button>
      </form>
    </div>
  );
}
