"use client";

import { useActionState } from "react";
import { Button, Card, CardTitle, ErrorText, Textarea } from "@/components/ui";
import { saveSettingAction, type AdminActionState } from "@/app/admin/actions";

/**
 * Config is edited as JSON and validated server-side against the same Zod
 * schema the engine reads it back with, so an invalid weight can never reach
 * a candidate-facing calculation.
 */
export function SettingEditor({
  settingKey,
  title,
  description,
  value,
}: {
  settingKey: string;
  title: string;
  description: string;
  value: unknown;
}) {
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    saveSettingAction.bind(null, settingKey),
    {},
  );

  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <p className="mt-1 text-xs leading-relaxed text-ink-500">{description}</p>
      <form action={action} className="mt-3 space-y-2">
        <Textarea
          name="value"
          rows={14}
          defaultValue={JSON.stringify(value, null, 2)}
          spellCheck={false}
          className="font-mono text-xs"
        />
        <ErrorText>{state.error}</ErrorText>
        {state.success ? (
          <p className="text-sm text-positive">{state.success}</p>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? "保存中…" : "保存"}
        </Button>
      </form>
    </Card>
  );
}
