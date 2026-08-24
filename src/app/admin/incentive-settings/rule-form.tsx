'use client';

import { useActionState } from 'react';
import { Field, Input, Select, SubmitButton } from '@/components/ui/forms';
import { createIncentiveRuleAction, type ActionState } from '@/app/admin/actions';
import { EVENT_LABELS } from '@/lib/format';

export function IncentiveRuleForm({ eventTypes }: { eventTypes: readonly string[] }) {
  const [state, formAction] = useActionState<ActionState, FormData>(createIncentiveRuleAction, {});
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="対象イベント" required>
        <Select name="eventType" required defaultValue="lead_registered">
          {eventTypes.map((value) => (
            <option key={value} value={value}>
              {EVENT_LABELS[value] ?? value}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="金額（円）" required>
        <Input name="amount" type="number" min={0} step={100} required defaultValue={500} />
      </Field>
      <Field label="説明">
        <Input name="description" placeholder="連絡先登録（有効リード）" />
      </Field>
      <Field label="適用開始日" required>
        <Input name="validFrom" type="date" required defaultValue={today} />
      </Field>
      <Field label="適用終了日" hint="空欄なら無期限">
        <Input name="validTo" type="date" />
      </Field>
      <Field label="条件: 市場価値スコア下限" hint="任意。質の低い獲得への支払いを防ぎます">
        <Input name="minMarketValueScore" type="number" min={0} max={100} step={1} />
      </Field>
      <div className="sm:col-span-2 lg:col-span-3">
        {state.error && <p className="mb-2 text-xs text-rose-600">{state.error}</p>}
        {state.success && <p className="mb-2 text-xs text-emerald-600">{state.success}</p>}
        <SubmitButton pendingLabel="追加中...">ルールを追加</SubmitButton>
      </div>
    </form>
  );
}
