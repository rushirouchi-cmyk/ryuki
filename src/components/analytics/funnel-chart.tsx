import { formatNumber, formatPercent } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export interface FunnelStep {
  label: string;
  value: number;
  /** Conversion from the previous step, already computed by the metrics layer. */
  rate: number | null;
  rateLabel: string;
}

/**
 * Server-rendered bars: a funnel is a set of proportions, so it needs no
 * interactivity and should not cost a client bundle.
 *
 * Bar widths use a square-root scale. Street acquisition spans three orders of
 * magnitude between "approached" and "joined", and on a linear scale every step
 * after the first collapses into an invisible sliver. The exact counts and
 * conversion rates are printed next to each bar, so the bars only have to
 * convey ordering.
 */
export function FunnelChart({ steps }: { steps: FunnelStep[] }) {
  const max = Math.max(...steps.map((step) => step.value), 1);
  const width = (value: number) => Math.max(1.5, Math.sqrt(value / max) * 100);

  return (
    <ol className="space-y-2">
      {steps.map((step, index) => (
        <li key={step.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium text-ink-700">{step.label}</span>
            <span className="tabular font-semibold text-ink-900">
              {formatNumber(step.value)}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink-100">
              <div
                className={cn(
                  "h-full rounded-full",
                  index === 0 ? "bg-brand-700" : "bg-brand-500",
                )}
                style={{ width: `${width(step.value)}%` }}
              />
            </div>
            <span className="tabular w-28 shrink-0 text-right text-xs text-ink-500">
              {index === 0
                ? step.rateLabel
                : `${step.rateLabel} ${formatPercent(step.rate)}`}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function FunnelScaleNote() {
  return (
    <p className="mt-3 text-xs text-ink-400">
      ※ バーの長さは平方根スケールです。件数の比較は数値をご覧ください。
    </p>
  );
}
