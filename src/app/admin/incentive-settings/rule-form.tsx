"use client";

import { useActionState } from "react";
import { Button, Card, CardTitle, ErrorText, Field, Input, Select } from "@/components/ui";
import { INCENTIVE_EVENT_LABELS } from "@/lib/utils/labels";
import { saveIncentiveRuleAction, type AdminActionState } from "@/app/admin/actions";

export function RuleForm() {
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    saveIncentiveRuleAction,
    {},
  );

  return (
    <Card>
      <CardTitle>ルールを追加</CardTitle>
      <form action={action} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="名称" required>
          <Input name="name" required maxLength={80} />
        </Field>
        <Field label="対象イベント" required>
          <Select name="eventType" required defaultValue="lead_registered">
            {Object.entries(INCENTIVE_EVENT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="金額（円）" required>
          <Input name="amountYen" type="number" min={0} step={100} required />
        </Field>
        <Field label="優先度" hint="小さいほど優先">
          <Input name="priority" type="number" min={1} max={1000} defaultValue={100} />
        </Field>
        <Field label="適用開始日" required>
          <Input name="validFrom" type="date" required />
        </Field>
        <Field label="適用終了日">
          <Input name="validTo" type="date" />
        </Field>
        <Field label="条件（JSON）" hint='例: {"minMatchRank":"B"}'>
          <Input name="conditions" placeholder="{}" />
        </Field>
        <label className="flex items-end gap-2 pb-2 text-sm text-ink-700">
          <input type="checkbox" name="active" defaultChecked className="h-4 w-4" />
          有効にする
        </label>

        <div className="sm:col-span-2 lg:col-span-4">
          <ErrorText>{state.error}</ErrorText>
          {state.success ? (
            <p className="mb-2 text-sm text-positive">{state.success}</p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? "保存中…" : "ルールを保存"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
