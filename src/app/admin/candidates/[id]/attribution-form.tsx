'use client';

import { useActionState } from 'react';
import { Field, Input, Select, SubmitButton } from '@/components/ui/forms';
import { overrideAttributionAction, type ActionState } from '@/app/admin/actions';

export function AttributionForm({
  candidateId,
  qrCodes,
  currentQrCodeId,
}: {
  candidateId: string;
  qrCodes: { id: string; label: string }[];
  currentQrCodeId: string | null;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(overrideAttributionAction, {});

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="candidateId" value={candidateId} />
      <Field label="紐づけ先のQRコード（営業担当 × 場所 × シフト）" required>
        <Select name="qrCodeId" defaultValue={currentQrCodeId ?? ''} required>
          <option value="" disabled>
            選択してください
          </option>
          {qrCodes.map((qr) => (
            <option key={qr.id} value={qr.id}>
              {qr.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="修正理由" required hint="監査ログに記録されます">
        <Input name="reason" placeholder="現地確認の結果、担当を訂正" required />
      </Field>
      {state.error && <p className="text-xs text-rose-600">{state.error}</p>}
      {state.success && <p className="text-xs text-emerald-600">{state.success}</p>}
      <SubmitButton variant="secondary" size="sm" pendingLabel="更新中...">
        アトリビューションを修正
      </SubmitButton>
    </form>
  );
}
