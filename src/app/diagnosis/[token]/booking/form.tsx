"use client";

import { useActionState, useState } from "react";
import { Button, Card, ErrorText } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { bookInterviewAction, type ActionState } from "../actions";

export function BookingForm({
  token,
  slots,
  name,
}: {
  token: string;
  slots: { value: string; label: string }[];
  name: string;
}) {
  const [selected, setSelected] = useState<string>("");
  const [state, action, pending] = useActionState<ActionState, FormData>(
    bookInterviewAction.bind(null, token),
    {},
  );

  return (
    <main className="px-5 pb-16 pt-8">
      <h1 className="text-2xl font-bold text-ink-900">キャリア面談のご予約</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-600">
        {name} 様、ご登録ありがとうございます。
        オンラインで30分程度、ご希望の条件と今後の進め方をお伺いします。
      </p>

      <Card className="mt-6">
        <form action={action}>
          <input type="hidden" name="scheduledAt" value={selected} />
          <fieldset>
            <legend className="mb-3 text-sm font-semibold text-ink-700">
              ご希望の日時を選択してください
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {slots.map((slot) => (
                <button
                  key={slot.value}
                  type="button"
                  aria-pressed={selected === slot.value}
                  onClick={() => setSelected(slot.value)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
                    selected === slot.value
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-ink-200 bg-white text-ink-700 hover:border-brand-300",
                  )}
                >
                  {slot.label}
                </button>
              ))}
            </div>
          </fieldset>

          <ErrorText>{state.error}</ErrorText>

          <div className="sticky bottom-4 mt-6">
            <Button type="submit" size="lg" full disabled={!selected || pending}>
              {pending ? "予約中…" : "この日時で予約する"}
            </Button>
          </div>
        </form>
      </Card>
    </main>
  );
}
