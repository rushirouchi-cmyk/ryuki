'use client';

import { useState, useTransition } from 'react';
import { recordActionAction, respondToAlertAction, runCandidateAgentsAction, updatePhaseAction } from '@/app/actions/candidates';
import { ACTION_TYPE_LABELS, ACTION_TYPES, CA_RESPONSE_CHOICES, CANDIDATE_PHASES, PHASE_LABELS } from '@/lib/domain/enums';

/** AI の状況確認への回答フォーム (§8)。選択肢と自由記述の両方を受け付ける。 */
export function AlertResponseForm({ alertId, question }: { alertId: string; question: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  return (
    <form
      className="space-y-2"
      action={(formData) => {
        startTransition(async () => {
          const res = await respondToAlertAction(formData);
          if (res && 'error' in res && res.error) setResult(res.error);
          else if (res && 'structured' in res && res.structured) {
            setResult(
              `回答を記録しました。状況「${res.structured.statusLabel}」/ 次回「${res.structured.nextAction ?? '未設定'}」`,
            );
          }
        });
      }}
    >
      <input type="hidden" name="alertId" value={alertId} />
      <pre className="whitespace-pre-wrap rounded bg-[var(--bg-subtle)] p-2 text-xxs leading-relaxed">
        {question}
      </pre>

      <div className="flex flex-wrap gap-2">
        {CA_RESPONSE_CHOICES.map((choice) => (
          <label key={choice.id} className="flex items-center gap-1 text-xxs">
            <input type="radio" name="choiceId" value={choice.id} />
            {choice.label}
          </label>
        ))}
      </div>

      <textarea
        name="freeText"
        rows={2}
        placeholder="自由記述（例: 昨日電話しましたが出なかったため、明日再度電話します。）"
        className="w-full rounded border border-[var(--border)] px-2 py-1 text-xs"
      />

      <div className="flex items-center gap-2">
        <button
          disabled={pending}
          className="rounded border border-[var(--accent)] bg-[var(--accent)] px-2.5 py-1 text-xs text-white disabled:opacity-50"
        >
          {pending ? '送信中...' : '回答してアラートを解消'}
        </button>
        {result && <span className="text-xxs text-[var(--text-muted)]">{result}</span>}
      </div>
    </form>
  );
}

/** 対応記録の登録。次回アクションを必ず入力させ、放置を構造的に防ぐ。 */
export function RecordActionForm({ candidateId }: { candidateId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="space-y-2"
      action={(formData) => {
        startTransition(async () => {
          const res = await recordActionAction(formData);
          setMessage(res?.error ?? '対応を記録しました。');
        });
      }}
    >
      <input type="hidden" name="candidateId" value={candidateId} />
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xxs text-[var(--text-muted)]">対応種別</span>
          <select name="actionType" className="mt-0.5 w-full rounded border border-[var(--border)] px-1.5 py-1 text-xs">
            {ACTION_TYPES.filter((t) => t !== 'ai_check').map((t) => (
              <option key={t} value={t}>
                {ACTION_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xxs text-[var(--text-muted)]">次回アクション予定日</span>
          <input
            type="date"
            name="nextActionDate"
            className="mt-0.5 w-full rounded border border-[var(--border)] px-1.5 py-1 text-xs"
          />
        </label>
      </div>
      <label className="block">
        <span className="text-xxs text-[var(--text-muted)]">次回アクション</span>
        <input
          name="nextAction"
          placeholder="例: 求人意向の確認"
          className="mt-0.5 w-full rounded border border-[var(--border)] px-1.5 py-1 text-xs"
        />
      </label>
      <label className="block">
        <span className="text-xxs text-[var(--text-muted)]">メモ</span>
        <textarea
          name="memo"
          rows={2}
          className="mt-0.5 w-full rounded border border-[var(--border)] px-1.5 py-1 text-xs"
        />
      </label>
      <div className="flex items-center gap-2">
        <button
          disabled={pending}
          className="rounded border border-[var(--accent)] bg-[var(--accent)] px-2.5 py-1 text-xs text-white disabled:opacity-50"
        >
          {pending ? '記録中...' : '対応を記録'}
        </button>
        {message && <span className="text-xxs text-[var(--text-muted)]">{message}</span>}
      </div>
    </form>
  );
}

/** フェーズ変更。AI ではなく人が確定する項目 (§51)。 */
export function PhaseForm({ candidateId, phase }: { candidateId: string; phase: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex items-center gap-1"
      action={(formData) => startTransition(async () => void (await updatePhaseAction(formData)))}
    >
      <input type="hidden" name="candidateId" value={candidateId} />
      <select name="phase" defaultValue={phase} className="rounded border border-[var(--border)] px-1.5 py-1 text-xs">
        {CANDIDATE_PHASES.map((p) => (
          <option key={p} value={p}>
            {PHASE_LABELS[p]}
          </option>
        ))}
      </select>
      <button disabled={pending} className="rounded border border-[var(--border)] px-2 py-1 text-xs disabled:opacity-50">
        {pending ? '更新中' : 'フェーズ変更'}
      </button>
    </form>
  );
}

/** 候補者単位で AI Agent を実行する。 */
export function RunAgentButton({
  candidateId,
  agent,
  label,
}: {
  candidateId: string;
  agent: 'structuring' | 'matching' | 'research';
  label: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <form action={(formData) => startTransition(async () => void (await runCandidateAgentsAction(formData)))}>
      <input type="hidden" name="candidateId" value={candidateId} />
      <input type="hidden" name="agent" value={agent} />
      <button
        disabled={pending}
        className="rounded border border-[var(--border)] bg-white px-2 py-1 text-xxs hover:bg-[var(--bg-subtle)] disabled:opacity-50"
      >
        {pending ? '実行中...' : label}
      </button>
    </form>
  );
}
