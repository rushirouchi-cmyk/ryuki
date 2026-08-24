'use client';

import { useActionState, useState } from 'react';
import { Field, Input, Select, SubmitButton } from '@/components/ui/forms';
import {
  bookInterviewAction,
  consentAndReferAction,
  registerLeadAction,
  type ConsentState,
  type InterviewState,
  type LeadState,
} from '@/app/diagnosis/actions';

function ErrorText({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-rose-50 px-4 py-2.5 text-xs text-rose-700">
      {message}
    </p>
  );
}

export function LeadForm({ token }: { token: string }) {
  const [state, formAction] = useActionState<LeadState, FormData>(
    registerLeadAction.bind(null, token),
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <Field label="お名前" required>
        <Input name="fullName" required autoComplete="name" placeholder="山本 大輝" />
      </Field>
      <Field label="メールアドレス" required>
        <Input name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
      </Field>
      <Field label="電話番号" required hint="キャリアアドバイザーからのご連絡に使用します">
        <Input name="phone" type="tel" required autoComplete="tel" placeholder="090-1234-5678" />
      </Field>
      <Field label="生まれ年" hint="任意">
        <Input name="birthYear" type="number" min={1940} max={2010} placeholder="1992" />
      </Field>
      <label className="flex items-start gap-2.5 text-xs leading-relaxed text-ink-700">
        <input type="checkbox" name="privacyAgreed" className="mt-0.5 h-4 w-4 rounded border-slate-300" />
        <span>
          <a href="/privacy" className="text-brand-600 underline">
            個人情報の取扱い
          </a>
          に同意します。この時点ではエージェント等の第三者へ情報は提供されません。
        </span>
      </label>
      <ErrorText message={state.error} />
      <SubmitButton size="lg" pendingLabel="登録中...">
        登録して次へ進む
      </SubmitButton>
    </form>
  );
}

export function InterviewForm({
  token,
  earliestSlot,
}: {
  token: string;
  /** computed on the server so the render stays pure */
  earliestSlot: string;
}) {
  const [state, formAction] = useActionState<InterviewState, FormData>(
    bookInterviewAction.bind(null, token),
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <Field label="ご希望の日時" required hint="30〜45分程度のオンライン面談です">
        <Input name="scheduledAt" type="datetime-local" required min={earliestSlot} />
      </Field>
      <Field label="面談方法" required>
        <Select name="mode" defaultValue="online">
          <option value="online">オンライン（ビデオ通話）</option>
          <option value="phone">電話</option>
        </Select>
      </Field>
      <ErrorText message={state.error} />
      <SubmitButton size="lg" pendingLabel="予約中...">
        キャリア面談を予約する
      </SubmitButton>
    </form>
  );
}

export interface AgentChoice {
  id: string;
  name: string;
  score: number;
  specialties: string[];
  reason: string;
}

export function AgentSelectionForm({
  token,
  agents,
  consentText,
}: {
  token: string;
  agents: AgentChoice[];
  consentText: string;
}) {
  const [selected, setSelected] = useState<string>('');
  const [state, formAction] = useActionState<ConsentState, FormData>(
    consentAndReferAction.bind(null, token),
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <ul className="space-y-3">
        {agents.map((agent) => (
          <li key={agent.id}>
            <label
              className={`block cursor-pointer rounded-2xl border p-4 transition-colors ${
                selected === agent.id
                  ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-200'
                  : 'border-slate-300 bg-white hover:border-brand-400'
              }`}
            >
              <span className="flex items-start gap-3">
                <input
                  type="radio"
                  name="agentCompanyId"
                  value={agent.id}
                  checked={selected === agent.id}
                  onChange={() => setSelected(agent.id)}
                  className="mt-1 h-4 w-4"
                />
                <span className="flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-ink-900">{agent.name}</span>
                    <span className="tabular text-xs text-ink-500">適合度 {agent.score}</span>
                  </span>
                  <span className="mt-1 block text-xs text-ink-500">{agent.specialties.join('・')}</span>
                  <span className="mt-1.5 block text-xs leading-relaxed text-ink-700">{agent.reason}</span>
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      {selected && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-bold text-amber-900">第三者提供への同意</p>
          <pre className="mt-2 max-h-48 overflow-y-auto text-[11px] leading-relaxed whitespace-pre-wrap text-amber-900">
            {consentText.replace('{agent}', agents.find((a) => a.id === selected)?.name ?? '')}
          </pre>
          <label className="mt-3 flex items-start gap-2.5 text-xs leading-relaxed text-amber-900">
            <input type="checkbox" name="consent" className="mt-0.5 h-4 w-4 rounded border-amber-400" />
            <span>上記の内容を確認し、選択したエージェントへの個人情報の提供に同意します。</span>
          </label>
        </div>
      )}

      <ErrorText message={state.error} />
      <SubmitButton size="lg" disabled={!selected} pendingLabel="送信中...">
        選択したエージェントへ紹介を依頼する
      </SubmitButton>
    </form>
  );
}
