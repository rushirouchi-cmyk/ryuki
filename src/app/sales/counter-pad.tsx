'use client';

import { useOptimistic, useTransition } from 'react';
import { adjustCounterAction } from './actions';

interface CounterProps {
  shiftId: string;
  venueName: string;
  approachCount: number;
  stoppedCount: number;
}

/**
 * One-handed street counter. Taps apply optimistically so the rep never waits
 * for the network, and each counter has a visible undo for mis-taps.
 */
export function CounterPad({ shiftId, venueName, approachCount, stoppedCount }: CounterProps) {
  const [, startTransition] = useTransition();
  const [counts, applyDelta] = useOptimistic(
    { approach: approachCount, stopped: stoppedCount },
    (state, action: { counter: 'approach' | 'stopped'; delta: number }) => ({
      ...state,
      [action.counter]: Math.max(0, state[action.counter] + action.delta),
    }),
  );

  const submit = (counter: 'approach' | 'stopped', delta: number) => {
    startTransition(async () => {
      applyDelta({ counter, delta });
      const formData = new FormData();
      formData.set('shiftId', shiftId);
      formData.set('counter', counter);
      formData.set('delta', String(delta));
      await adjustCounterAction(formData);
    });
  };

  const buttons: { counter: 'approach' | 'stopped'; label: string; value: number }[] = [
    { counter: 'approach', label: '声掛け', value: counts.approach },
    { counter: 'stopped', label: '立ち止まり', value: counts.stopped },
  ];

  return (
    <section className="rounded-2xl border border-brand-200 bg-brand-50 p-4">
      <p className="text-xs font-semibold text-brand-700">営業中 · {venueName}</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {buttons.map((button) => (
          <div key={button.counter} className="rounded-2xl bg-white p-3 text-center">
            <p className="text-xs text-ink-500">{button.label}</p>
            <p className="tabular mt-1 text-3xl font-bold text-ink-900">{button.value}</p>
            <button
              type="button"
              onClick={() => submit(button.counter, 1)}
              className="mt-2 w-full rounded-xl bg-brand-600 py-4 text-lg font-bold text-white active:bg-brand-700"
              aria-label={`${button.label}を1件追加`}
            >
              +1
            </button>
            <button
              type="button"
              onClick={() => submit(button.counter, -1)}
              disabled={button.value === 0}
              className="mt-1.5 w-full rounded-lg py-1.5 text-xs text-ink-500 hover:bg-slate-100 disabled:opacity-40"
              aria-label={`${button.label}を1件取り消し`}
            >
              取り消し −1
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
