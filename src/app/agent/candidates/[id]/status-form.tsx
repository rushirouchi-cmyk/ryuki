'use client';

import { useActionState, useState } from 'react';
import { Field, Input, Select, SubmitButton } from '@/components/ui/forms';
import { updateReferralAction, type ReferralUpdateState } from '@/app/agent/actions';
import { REFERRAL_STATUS_LABELS } from '@/lib/format';

const STATUSES = [
  'accepted',
  'declined',
  'contacted',
  'interview_scheduled',
  'interview_completed',
  'application',
  'offer',
  'joined',
  'lost',
] as const;

export function StatusForm({
  referralId,
  currentStatus,
  defaults,
}: {
  referralId: string;
  currentStatus: string;
  defaults: {
    offerCompanyName: string;
    offerJobTitle: string;
    offerSalary: string;
    offerDate: string;
    joinedDate: string;
  };
}) {
  const [status, setStatus] = useState<string>(currentStatus);
  const [state, formAction] = useActionState<ReferralUpdateState, FormData>(updateReferralAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="referralId" value={referralId} />
      <Field label="ステータス" required>
        <Select name="status" value={status} onChange={(event) => setStatus(event.target.value)}>
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {REFERRAL_STATUS_LABELS[value] ?? value}
            </option>
          ))}
        </Select>
      </Field>

      {(status === 'offer' || status === 'joined') && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="内定先企業">
            <Input name="offerCompanyName" defaultValue={defaults.offerCompanyName} />
          </Field>
          <Field label="職種・ポジション">
            <Input name="offerJobTitle" defaultValue={defaults.offerJobTitle} />
          </Field>
          <Field label="提示年収（円）" required hint="例: 5800000">
            <Input name="offerSalary" type="number" min={0} step={10000} defaultValue={defaults.offerSalary} />
          </Field>
          <Field label="内定日">
            <Input name="offerDate" type="date" defaultValue={defaults.offerDate} />
          </Field>
        </div>
      )}

      {status === 'joined' && (
        <Field label="入社日" required>
          <Input name="joinedDate" type="date" defaultValue={defaults.joinedDate} />
        </Field>
      )}

      {(status === 'lost' || status === 'declined') && (
        <Field label="理由">
          <Input name="lostReason" placeholder="条件不一致 / 連絡不通 など" />
        </Field>
      )}

      <Field label="メモ">
        <Input name="notes" placeholder="社内メモ" />
      </Field>

      {state.error && (
        <p role="alert" className="rounded-xl bg-rose-50 px-4 py-2.5 text-xs text-rose-700">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-xl bg-emerald-50 px-4 py-2.5 text-xs text-emerald-700">更新しました。</p>
      )}

      <SubmitButton pendingLabel="更新中...">ステータスを更新</SubmitButton>
    </form>
  );
}
