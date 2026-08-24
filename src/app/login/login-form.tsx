'use client';

import { useActionState } from 'react';
import { Field, Input, SubmitButton } from '@/components/ui/forms';
import { loginAction, type LoginState } from './actions';

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <Field label="メールアドレス" required>
        <Input name="email" type="email" autoComplete="username" required placeholder="admin@example.com" />
      </Field>
      <Field label="パスワード" required>
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      {state.error && (
        <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.error}
        </p>
      )}
      <SubmitButton size="lg" pendingLabel="ログイン中...">
        ログイン
      </SubmitButton>
    </form>
  );
}
