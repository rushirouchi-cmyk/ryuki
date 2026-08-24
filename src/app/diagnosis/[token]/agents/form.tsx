"use client";

import { useActionState, useState } from "react";
import { Button, Card, EmptyState, ErrorText } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { referAction, type ActionState } from "../actions";

export interface RecommendationItem {
  agentCompanyId: number;
  name: string;
  score: number;
  rankOrder: number;
  reasons: string[];
  notes: string | null;
}

export function AgentChoiceForm({
  token,
  consentText,
  recommendations,
}: {
  token: string;
  consentText: string;
  recommendations: RecommendationItem[];
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    referAction.bind(null, token),
    {},
  );

  if (recommendations.length === 0) {
    return (
      <main className="px-5 pb-16 pt-8">
        <EmptyState
          title="現在ご紹介できるエージェントがありません"
          description="キャリア面談で担当者から直接ご案内します。"
        />
      </main>
    );
  }

  const toggle = (id: number) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  return (
    <main className="px-5 pb-16 pt-8">
      <h1 className="text-2xl font-bold text-ink-900">あなたにおすすめのエージェント</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-600">
        診断結果と希望条件をもとに、相性のよいエージェントをご提案しています。
        <strong className="font-semibold text-ink-800">
          あなたが選択したエージェントにのみ
        </strong>
        情報を提供します。
      </p>

      <form action={action}>
        <ul className="mt-6 space-y-3">
          {recommendations.map((recommendation) => {
            const active = selected.includes(recommendation.agentCompanyId);
            return (
              <li key={recommendation.agentCompanyId}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggle(recommendation.agentCompanyId)}
                  className={cn(
                    "w-full rounded-2xl border p-4 text-left transition-colors",
                    active
                      ? "border-brand-500 bg-brand-50"
                      : "border-ink-200 bg-white hover:border-brand-300",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink-900">{recommendation.name}</p>
                      {recommendation.notes ? (
                        <p className="mt-0.5 text-xs text-ink-500">
                          {recommendation.notes}
                        </p>
                      ) : null}
                    </div>
                    <span
                      className={cn(
                        "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                        active
                          ? "border-brand-500 bg-brand-500 text-white"
                          : "border-ink-300 text-transparent",
                      )}
                      aria-hidden
                    >
                      ✓
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {recommendation.reasons.map((reason) => (
                      <li key={reason} className="text-xs text-ink-600">
                        ・{reason}
                      </li>
                    ))}
                  </ul>
                </button>
                {active ? (
                  <input
                    type="hidden"
                    name="agentCompanyId"
                    value={recommendation.agentCompanyId}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>

        <Card className="mt-6">
          <h2 className="text-sm font-semibold text-ink-700">第三者提供への同意</h2>
          <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-xl bg-ink-50 p-3 text-xs leading-relaxed text-ink-600">
            {consentText}
          </pre>
          <label className="mt-3 flex items-start gap-2 text-sm text-ink-800">
            <input
              type="checkbox"
              name="consent"
              className="mt-1 h-4 w-4 rounded border-ink-300"
            />
            <span>上記に同意し、選択したエージェントへの情報提供を許可します</span>
          </label>
        </Card>

        <ErrorText>{state.error}</ErrorText>

        <div className="sticky bottom-4 mt-6">
          <Button type="submit" size="lg" full disabled={selected.length === 0 || pending}>
            {pending
              ? "送信中…"
              : selected.length === 0
                ? "エージェントを選択してください"
                : `選択した${selected.length}社に紹介を依頼する`}
          </Button>
        </div>
      </form>
    </main>
  );
}
