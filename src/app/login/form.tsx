"use client";

import { useActionState } from "react";
import { Button, Card, ErrorText, Field, Input } from "@/components/ui";
import { loginAction, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-12">
      <h1 className="text-2xl font-bold text-ink-900">Career Routing Engine</h1>
      <p className="mt-1 text-sm text-ink-500">管理者 / 営業 / エージェント 用ログイン</p>

      <Card className="mt-6">
        <form action={action} className="space-y-4">
          <Field label="メールアドレス" required>
            <Input name="email" type="email" autoComplete="username" required />
          </Field>
          <Field label="パスワード" required>
            <Input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>

          <ErrorText>{state.error}</ErrorText>

          <Button type="submit" size="lg" full disabled={pending}>
            {pending ? "確認中…" : "ログイン"}
          </Button>
        </form>
      </Card>

      <p className="mt-6 text-center text-xs text-ink-400">
        候補者向けの年収診断はログイン不要です。
      </p>
    </main>
  );
}
