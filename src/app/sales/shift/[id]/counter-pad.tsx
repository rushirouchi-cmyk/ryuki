"use client";

import { useOptimistic, useTransition } from "react";
import { Card } from "@/components/ui";
import { adjustCounterAction } from "../../actions";

interface Counters {
  approach: number;
  stopped: number;
}

/**
 * One-tap counters for use while standing on a street corner: large targets,
 * optimistic feedback, and an explicit correction button for mis-taps.
 */
export function CounterPad({
  shiftId,
  approachCount,
  stoppedCount,
}: {
  shiftId: number;
  approachCount: number;
  stoppedCount: number;
}) {
  const [, startTransition] = useTransition();
  const [counters, applyDelta] = useOptimistic<Counters, { type: keyof Counters; delta: number }>(
    { approach: approachCount, stopped: stoppedCount },
    (state, action) => ({
      ...state,
      [action.type]: Math.max(0, state[action.type] + action.delta),
    }),
  );

  const submit = (type: keyof Counters, delta: number) => {
    const formData = new FormData();
    formData.set("shiftId", String(shiftId));
    formData.set("counterType", type === "approach" ? "approach" : "stopped");
    formData.set("delta", String(delta));

    startTransition(async () => {
      applyDelta({ type, delta });
      await adjustCounterAction(formData);
    });
  };

  const rows: { type: keyof Counters; label: string; value: number }[] = [
    { type: "approach", label: "声掛け", value: counters.approach },
    { type: "stopped", label: "立ち止まり", value: counters.stopped },
  ];

  return (
    <Card className="mb-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.type} className="rounded-2xl border border-ink-200 p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-ink-600">{row.label}</span>
              <span className="tabular text-3xl font-bold text-ink-900">{row.value}</span>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => submit(row.type, 1)}
                className="h-20 flex-1 rounded-xl bg-brand-600 text-lg font-bold text-white active:bg-brand-700"
              >
                +1
              </button>
              <button
                type="button"
                aria-label={`${row.label}を1件取り消す`}
                onClick={() => submit(row.type, -1)}
                disabled={row.value === 0}
                className="h-20 w-20 rounded-xl border border-ink-300 text-sm font-semibold text-ink-600 disabled:opacity-40"
              >
                取消
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink-500">
        QR読取以降の実績は自動で集計されます。押し間違えは「取消」で修正できます。
      </p>
    </Card>
  );
}
