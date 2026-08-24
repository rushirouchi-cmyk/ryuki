"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, ErrorText, ProgressBar } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import {
  DIAGNOSIS_QUESTIONS,
  type DiagnosisQuestion,
} from "@/lib/domain/diagnosis/questionnaire";
import { submitDiagnosisAction } from "../actions";

export interface WizardOptions {
  occupations: { id: number; name: string; category: string }[];
  skills: { id: number; name: string; category: string }[];
  certifications: { id: number; name: string }[];
  regions: { id: number; name: string; prefecture: string }[];
}

type AnswerValue = string | number | boolean | number[] | string[];

function optionsFor(
  question: DiagnosisQuestion,
  dynamic: WizardOptions,
): { value: string; label: string; group?: string }[] {
  if (question.options) return [...question.options];
  switch (question.source) {
    case "occupations":
      return dynamic.occupations.map((row) => ({
        value: String(row.id),
        label: row.name,
        group: row.category,
      }));
    case "skills":
      return dynamic.skills.map((row) => ({
        value: String(row.id),
        label: row.name,
        group: row.category,
      }));
    case "certifications":
      return dynamic.certifications.map((row) => ({
        value: String(row.id),
        label: row.name,
      }));
    case "regions":
      return dynamic.regions.map((row) => ({
        value: String(row.id),
        label: `${row.prefecture} ${row.name}`,
      }));
    default:
      return [];
  }
}

const NUMERIC_SINGLE = new Set(["currentOccupationId", "currentRegionId"]);
const NUMERIC_MULTI = new Set(["skillIds", "certificationIds", "desiredRegionIds"]);

export function Wizard({ token, options }: { token: string; options: WizardOptions }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const question = DIAGNOSIS_QUESTIONS[index];
  const total = DIAGNOSIS_QUESTIONS.length;

  const choices = useMemo(
    () => (question ? optionsFor(question, options) : []),
    [question, options],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, typeof choices>();
    for (const choice of choices) {
      const key = choice.group ?? "";
      const bucket = map.get(key) ?? [];
      bucket.push(choice);
      map.set(key, bucket);
    }
    return [...map.entries()];
  }, [choices]);

  if (!question) return null;

  const current = answers[question.id];
  const selected = new Set(
    Array.isArray(current) ? current.map((value) => String(value)) : [],
  );

  const answered =
    question.kind === "multi"
      ? question.allowEmpty || selected.size > 0
      : current !== undefined;

  const goNext = (nextAnswers: Record<string, AnswerValue>) => {
    setError(undefined);
    if (index + 1 < total) {
      setIndex(index + 1);
      return;
    }
    startTransition(async () => {
      const result = await submitDiagnosisAction(token, nextAnswers);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(`/diagnosis/${token}/result`);
    });
  };

  const selectSingle = (value: string) => {
    const parsed: AnswerValue =
      question.kind === "boolean"
        ? value === "true"
        : NUMERIC_SINGLE.has(question.id)
          ? Number(value)
          : value;
    const next = { ...answers, [question.id]: parsed };
    setAnswers(next);
    goNext(next);
  };

  const toggleMulti = (value: string) => {
    const numeric = NUMERIC_MULTI.has(question.id);
    const existing = Array.isArray(current) ? [...current] : [];
    const parsed = numeric ? Number(value) : value;
    const position = existing.findIndex((item) => String(item) === value);
    if (position >= 0) existing.splice(position, 1);
    else existing.push(parsed as never);
    setAnswers({ ...answers, [question.id]: existing as AnswerValue });
    setError(undefined);
  };

  return (
    <main className="flex min-h-dvh flex-col px-5 pb-8 pt-6">
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-xs text-ink-500">
          <span>
            質問 {index + 1} / {total}
          </span>
          <span>のこり約{Math.max(1, Math.ceil(((total - index) * 5) / 10) * 10)}秒</span>
        </div>
        <ProgressBar value={index} max={total} />
      </div>

      <h1 className="text-xl font-bold text-ink-900">{question.title}</h1>
      {question.help ? (
        <p className="mt-2 text-sm text-ink-500">{question.help}</p>
      ) : null}

      <div className="mt-6 flex-1">
        {question.kind === "boolean" ? (
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: "true", label: "はい" },
              { value: "false", label: "いいえ" },
            ].map((choice) => (
              <button
                key={choice.value}
                type="button"
                onClick={() => selectSingle(choice.value)}
                className={cn(
                  "rounded-2xl border px-4 py-6 text-base font-semibold transition-colors",
                  String(current) === choice.value
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-ink-200 bg-white text-ink-800 hover:border-brand-300",
                )}
              >
                {choice.label}
              </button>
            ))}
          </div>
        ) : question.kind === "single" ? (
          <div className="space-y-4">
            {grouped.map(([group, items]) => (
              <div key={group}>
                {group ? (
                  <p className="mb-1.5 text-xs font-semibold text-ink-400">{group}</p>
                ) : null}
                <div className="space-y-2">
                  {items.map((choice) => (
                    <button
                      key={choice.value}
                      type="button"
                      onClick={() => selectSingle(choice.value)}
                      className={cn(
                        "w-full rounded-xl border px-4 py-3.5 text-left text-sm font-medium transition-colors",
                        String(current) === choice.value
                          ? "border-brand-500 bg-brand-50 text-brand-700"
                          : "border-ink-200 bg-white text-ink-800 hover:border-brand-300",
                      )}
                    >
                      {choice.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map(([group, items]) => (
              <div key={group}>
                {group ? (
                  <p className="mb-1.5 text-xs font-semibold text-ink-400">{group}</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {items.map((choice) => {
                    const active = selected.has(choice.value);
                    return (
                      <button
                        key={choice.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleMulti(choice.value)}
                        className={cn(
                          "rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
                          active
                            ? "border-brand-500 bg-brand-500 text-white"
                            : "border-ink-200 bg-white text-ink-700 hover:border-brand-300",
                        )}
                      >
                        {choice.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ErrorText>{error}</ErrorText>

      <div className="sticky bottom-4 mt-6 space-y-2">
        {question.kind === "multi" ? (
          <Button
            size="lg"
            full
            disabled={!answered || pending}
            onClick={() => goNext(answers)}
          >
            {pending
              ? "診断中…"
              : index + 1 === total
                ? "診断結果を見る"
                : selected.size === 0
                  ? "当てはまるものがない"
                  : `次へ（${selected.size}件選択中）`}
          </Button>
        ) : null}
        {index > 0 ? (
          <Button
            variant="ghost"
            full
            disabled={pending}
            onClick={() => {
              setError(undefined);
              setIndex(index - 1);
            }}
          >
            ひとつ前に戻る
          </Button>
        ) : null}
      </div>
    </main>
  );
}
