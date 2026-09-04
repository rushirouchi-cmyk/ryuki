'use client';

import { useState, useTransition } from 'react';
import { rerankOpportunitiesAction, updateOpportunityAction } from '@/app/actions/business-development';
import { BD_STATUSES, BD_STATUS_LABELS } from '@/lib/domain/enums';

export function OpportunityStatusForm({
  opportunityId,
  status,
  ownerRaId,
  ras,
}: {
  opportunityId: string;
  status: string;
  ownerRaId: string | null;
  ras: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex items-center gap-1"
      action={(formData) => startTransition(async () => void (await updateOpportunityAction(formData)))}
    >
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <select name="ownerRaId" defaultValue={ownerRaId ?? ''} className="rounded border border-[var(--border)] px-1 py-0.5 text-xxs">
        <option value="">RA未割当</option>
        {ras.map((ra) => (
          <option key={ra.id} value={ra.id}>{ra.name}</option>
        ))}
      </select>
      <select name="status" defaultValue={status} className="rounded border border-[var(--border)] px-1 py-0.5 text-xxs">
        {BD_STATUSES.map((s) => (
          <option key={s} value={s}>{BD_STATUS_LABELS[s]}</option>
        ))}
      </select>
      <button disabled={pending} className="rounded border border-[var(--border)] px-1.5 py-0.5 text-xxs disabled:opacity-50">
        {pending ? '...' : '更新'}
      </button>
    </form>
  );
}

export function RerankButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-2">
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await rerankOpportunitiesAction();
            setMessage(res.ok ? `${res.evaluated}社を再評価しました` : 'エラーが発生しました');
          })
        }
        className="rounded border border-[var(--accent)] bg-[var(--accent)] px-2.5 py-1 text-xs text-white disabled:opacity-50"
      >
        {pending ? '再評価中...' : 'BD Agent を実行'}
      </button>
      {message && <span className="text-xxs text-[var(--text-muted)]">{message}</span>}
    </div>
  );
}
