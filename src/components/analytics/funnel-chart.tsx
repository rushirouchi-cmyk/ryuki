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
 */
export function FunnelChart({ steps }: { steps: FunnelStep[] }) {
  const max = Math.max(...steps.map((step) => step.value), 1);

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
                style={{ width: `${Math.max(1, (step.value / max) * 100)}%` }}
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
