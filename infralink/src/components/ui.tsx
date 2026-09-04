import Link from 'next/link';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { ALERT_LEVEL_LABELS, type AlertLevel, type AiConfidence } from '@/lib/domain/enums';

/**
 * 共通 UI パーツ。
 * 色だけに意味を持たせず、必ずアイコン (記号) とテキストを併記する (§45)。
 */

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] bg-white px-6 py-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-0.5 text-xs text-[var(--text-muted)]">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={clsx('rounded-md border border-[var(--border)] bg-white', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-2.5">
          <div>
            {title && <h2 className="text-sm font-semibold">{title}</h2>}
            {subtitle && <p className="text-xxs text-[var(--text-muted)]">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  tone = 'normal',
  hint,
}: {
  label: string;
  value: ReactNode;
  tone?: 'normal' | 'warn' | 'late' | 'crit' | 'done';
  hint?: string;
}) {
  const toneClass = {
    normal: 'text-[var(--text)]',
    warn: 'text-warn-fg',
    late: 'text-late-fg',
    crit: 'text-crit-fg',
    done: 'text-done-fg',
  }[tone];
  return (
    <div className="rounded-md border border-[var(--border)] bg-white px-3 py-2.5">
      <div className="text-xxs text-[var(--text-muted)]">{label}</div>
      <div className={clsx('tabular mt-0.5 text-xl font-semibold', toneClass)}>{value}</div>
      {hint && <div className="text-xxs text-[var(--text-muted)]">{hint}</div>}
    </div>
  );
}

const LEVEL_STYLES: Record<AlertLevel, { cls: string; icon: string }> = {
  1: { cls: 'bg-warn-bg text-warn-fg border-warn-line', icon: '△' },
  2: { cls: 'bg-late-bg text-late-fg border-late-line', icon: '!' },
  3: { cls: 'bg-crit-bg text-crit-fg border-crit-line', icon: '■' },
};

/** アラートレベル表示。記号 + レベル名 + 数値の三重表現。 */
export function AlertBadge({ level, suffix }: { level: AlertLevel; suffix?: string }) {
  const style = LEVEL_STYLES[level];
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xxs font-medium', style.cls)}>
      <span aria-hidden>{style.icon}</span>
      <span>
        Lv{level} {ALERT_LEVEL_LABELS[level]}
      </span>
      {suffix && <span className="tabular opacity-80">{suffix}</span>}
    </span>
  );
}

export function Badge({
  children,
  tone = 'normal',
}: {
  children: ReactNode;
  tone?: 'normal' | 'warn' | 'late' | 'crit' | 'done' | 'accent';
}) {
  const cls = {
    normal: 'bg-normal-bg text-normal-fg border-normal-line',
    warn: 'bg-warn-bg text-warn-fg border-warn-line',
    late: 'bg-late-bg text-late-fg border-late-line',
    crit: 'bg-crit-bg text-crit-fg border-crit-line',
    done: 'bg-done-bg text-done-fg border-done-line',
    accent: 'bg-[#eef3ff] text-[#1746a2] border-[#c6d8ff]',
  }[tone];
  return (
    <span className={clsx('inline-flex items-center rounded border px-1.5 py-0.5 text-xxs font-medium', cls)}>
      {children}
    </span>
  );
}

/** Match Score / BD Score の表示。数値と帯で二重に示す。 */
export function ScoreChip({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' }) {
  const tone = score >= 85 ? 'done' : score >= 70 ? 'accent' : score >= 55 ? 'warn' : 'normal';
  const cls = {
    done: 'bg-done-bg text-done-fg border-done-line',
    accent: 'bg-[#eef3ff] text-[#1746a2] border-[#c6d8ff]',
    warn: 'bg-warn-bg text-warn-fg border-warn-line',
    normal: 'bg-normal-bg text-normal-fg border-normal-line',
  }[tone];
  return (
    <span
      className={clsx(
        'tabular inline-flex items-center rounded border font-semibold',
        cls,
        size === 'sm' ? 'px-1.5 py-0.5 text-xxs' : 'px-2 py-1 text-sm',
      )}
    >
      {score}
      <span className="ml-0.5 text-xxs font-normal opacity-70">/100</span>
    </span>
  );
}

/** AI Confidence 表示 (§38)。 */
export function ConfidenceBadge({ confidence }: { confidence: AiConfidence | string }) {
  const tone = confidence === 'High' ? 'done' : confidence === 'Medium' ? 'warn' : 'crit';
  const icon = confidence === 'High' ? '●●●' : confidence === 'Medium' ? '●●○' : '●○○';
  return (
    <Badge tone={tone}>
      <span className="mr-1 tracking-tighter" aria-hidden>
        {icon}
      </span>
      Confidence: {confidence}
    </Badge>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-xs text-[var(--text-muted)]">{children}</p>;
}

export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-full text-xs">
        <thead>
          <tr className="border-b border-[var(--border)] text-left text-xxs text-[var(--text-muted)]">
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-2 py-1.5 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Row({ children, href }: { children: ReactNode; href?: string }) {
  const tr = <tr className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-subtle)]">{children}</tr>;
  return href ? tr : tr;
}

export function Cell({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={clsx('px-2 py-1.5 align-top', className)}>{children}</td>;
}

export function LinkText({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-[var(--accent)] hover:underline">
      {children}
    </Link>
  );
}

export function Button({
  children,
  variant = 'default',
  type = 'submit',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' | 'ghost' }) {
  const cls = {
    default: 'border-[var(--border)] bg-white hover:bg-[var(--bg-subtle)]',
    primary: 'border-[var(--accent)] bg-[var(--accent)] text-white hover:opacity-90',
    ghost: 'border-transparent hover:bg-[var(--bg-subtle)]',
  }[variant];
  return (
    <button
      type={type}
      {...rest}
      className={clsx('rounded border px-2.5 py-1 text-xs font-medium disabled:opacity-50', cls, rest.className)}
    >
      {children}
    </button>
  );
}

/** スコア内訳の可視化 (§37)。プラス要因とマイナス要因を必ず両方見せる。 */
export function ScoreBreakdown({
  factors,
  adjustments,
}: {
  factors: { label: string; weight: number; earned: number; note: string }[];
  adjustments?: { label: string; points: number }[];
}) {
  return (
    <div className="space-y-1.5">
      {factors.map((f) => {
        const ratio = f.weight > 0 ? Math.max(0, Math.min(1, f.earned / f.weight)) : 0;
        return (
          <div key={f.label} className="text-xs">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium">{f.label}</span>
              <span className="tabular text-xxs text-[var(--text-muted)]">
                +{f.earned} / {f.weight}
              </span>
            </div>
            <div className="mt-0.5 h-1.5 w-full rounded bg-[var(--bg-subtle)]">
              <div
                className="h-1.5 rounded bg-[var(--accent)]"
                style={{ width: `${ratio * 100}%` }}
                aria-hidden
              />
            </div>
            <p className="mt-0.5 text-xxs text-[var(--text-muted)]">{f.note}</p>
          </div>
        );
      })}
      {adjustments && adjustments.length > 0 && (
        <div className="mt-2 border-t border-[var(--border)] pt-2">
          {adjustments.map((a) => (
            <div key={a.label} className="flex justify-between text-xs text-crit-fg">
              <span>{a.label}</span>
              <span className="tabular">{a.points}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
