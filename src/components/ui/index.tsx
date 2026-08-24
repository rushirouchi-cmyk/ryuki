import clsx from 'clsx';
import type { ReactNode } from 'react';

export function Card({
  children,
  className,
  title,
  description,
  action,
}: {
  children?: ReactNode;
  className?: string;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className={clsx('rounded-2xl border border-slate-200 bg-white shadow-sm', className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
            {description && <p className="mt-1 text-xs text-ink-500">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'default' | 'positive' | 'negative' | 'brand';
}) {
  const toneClass = {
    default: 'text-ink-900',
    positive: 'text-emerald-600',
    negative: 'text-rose-600',
    brand: 'text-brand-600',
  }[tone];
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs text-ink-500">{label}</p>
      <p className={clsx('tabular mt-1 text-xl font-bold', toneClass)}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-ink-500">{sub}</p>}
    </div>
  );
}

const BADGE_TONES = {
  neutral: 'bg-slate-100 text-ink-700',
  brand: 'bg-brand-100 text-brand-700',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-rose-100 text-rose-700',
} as const;

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof BADGE_TONES;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function RankBadge({ rank, size = 'md' }: { rank: string; size?: 'md' | 'lg' }) {
  const tone =
    rank === 'S'
      ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white'
      : rank === 'A'
        ? 'bg-gradient-to-br from-brand-500 to-brand-700 text-white'
        : rank === 'B'
          ? 'bg-slate-200 text-ink-700'
          : 'bg-slate-100 text-ink-500';
  return (
    <span
      className={clsx(
        'inline-flex items-center justify-center rounded-xl font-bold',
        tone,
        size === 'lg' ? 'h-16 w-16 text-3xl' : 'h-8 w-8 text-sm',
      )}
    >
      {rank}
    </span>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
      <p className="text-sm font-medium text-ink-700">{title}</p>
      {description && <p className="mt-1 text-xs text-ink-500">{description}</p>}
    </div>
  );
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className={clsx('w-full min-w-max border-collapse text-sm', className)}>{children}</table>
    </div>
  );
}

export function Th({
  children,
  align = 'left',
  className,
}: {
  children?: ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
}) {
  return (
    <th
      className={clsx(
        'whitespace-nowrap border-b border-slate-200 px-3 py-2 text-xs font-semibold text-ink-500',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        align === 'left' && 'text-left',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = 'left',
  className,
}: {
  children?: ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
}) {
  return (
    <td
      className={clsx(
        'whitespace-nowrap border-b border-slate-100 px-3 py-2',
        align === 'right' && 'tabular text-right',
        align === 'center' && 'text-center',
        className,
      )}
    >
      {children}
    </td>
  );
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, value * 100));
  return (
    <div>
      {label && <p className="mb-1 text-xs text-ink-500">{label}</p>}
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Alert({
  children,
  tone = 'info',
}: {
  children: ReactNode;
  tone?: 'info' | 'warning' | 'danger' | 'success';
}) {
  const tones = {
    info: 'border-brand-200 bg-brand-50 text-brand-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    danger: 'border-rose-200 bg-rose-50 text-rose-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  };
  return <div className={clsx('rounded-xl border px-4 py-3 text-sm', tones[tone])}>{children}</div>;
}
