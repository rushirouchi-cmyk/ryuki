"use client";

import { useActionState } from "react";
import { Button, ErrorText, Input, Select } from "@/components/ui";
import { overrideAttributionAction, type AdminActionState } from "@/app/admin/actions";

export function AttributionForm({
  candidateId,
  currentSalesUserId,
  salesUsers,
}: {
  candidateId: string;
  currentSalesUserId: string | null;
  salesUsers: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    overrideAttributionAction,
    {},
  );

  return (
    <form action={action} className="space-y-2">
      <p className="text-xs font-semibold text-ink-500">紐づけの修正</p>
      <input type="hidden" name="candidateId" value={candidateId} />
      <Select name="salesUserId" defaultValue={currentSalesUserId ?? ""} required>
        <option value="" disabled>
          営業担当を選択
        </option>
        {salesUsers.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name}
          </option>
        ))}
      </Select>
      <Input name="reason" placeholder="修正理由（監査ログに記録されます）" required />
      <ErrorText>{state.error}</ErrorText>
      {state.success ? (
        <p className="text-xs text-positive">{state.success}</p>
      ) : null}
      <Button type="submit" variant="secondary" size="sm" full disabled={pending}>
        {pending ? "更新中…" : "紐づけを修正"}
      </Button>
    </form>
  );
}
