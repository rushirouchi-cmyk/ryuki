'use client';

import { useState, useTransition } from 'react';
import { confirmRejectionTagAction, suggestRejectionTagAction } from '@/app/actions/candidates';
import { REJECTION_TAGS, REJECTION_TAG_LABELS, type RejectionTag } from '@/lib/domain/enums';

/**
 * 見送り理由タグ (§34/§51)。
 * AI は提案するだけで、確定は人が行う。原文はここでは編集できない。
 */
export function RejectionTagForm({
  applicationId,
  currentTag,
  confirmed,
}: {
  applicationId: string;
  currentTag: string | null;
  confirmed: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [suggestion, setSuggestion] = useState<{ label: string; rationale: string; confidence: string } | null>(null);

  return (
    <div className="space-y-1.5">
      <form
        className="flex flex-wrap items-center gap-1.5"
        action={(formData) => startTransition(async () => void (await confirmRejectionTagAction(formData)))}
      >
        <input type="hidden" name="applicationId" value={applicationId} />
        <span className="text-xxs text-[var(--text-muted)]">見送り理由タグ</span>
        <select
          name="tag"
          defaultValue={currentTag ?? 'other'}
          className="rounded border border-[var(--border)] px-1.5 py-0.5 text-xxs"
        >
          {REJECTION_TAGS.map((tag) => (
            <option key={tag} value={tag}>
              {REJECTION_TAG_LABELS[tag as RejectionTag]}
            </option>
          ))}
        </select>
        <button disabled={pending} className="rounded border border-[var(--border)] px-2 py-0.5 text-xxs disabled:opacity-50">
          {confirmed ? '再確定' : '確定'}
        </button>
        {!confirmed && currentTag && (
          <span className="rounded border border-warn-line bg-warn-bg px-1.5 py-0.5 text-xxs text-warn-fg">
            △ AI提案（人による確定待ち）
          </span>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await suggestRejectionTagAction(applicationId);
              if (result) setSuggestion({ label: result.label, rationale: result.rationale, confidence: result.confidence });
            })
          }
          className="rounded border border-[var(--border)] px-2 py-0.5 text-xxs disabled:opacity-50"
        >
          AIに提案させる
        </button>
      </form>
      {suggestion && (
        <p className="text-xxs text-[var(--text-muted)]">
          AI提案: <strong>{suggestion.label}</strong>（Confidence: {suggestion.confidence}） / 根拠: {suggestion.rationale}
        </p>
      )}
    </div>
  );
}
