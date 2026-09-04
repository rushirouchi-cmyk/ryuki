'use client';

import { useActionState } from 'react';
import { loginAction } from '@/app/actions/auth';

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, undefined);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-md border border-[var(--border)] bg-white p-6">
        <h1 className="text-base font-semibold">INFRALINK Talent Intelligence</h1>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          インフラリンク株式会社 AI人材紹介オペレーションシステム
        </p>

        <form action={action} className="mt-5 space-y-3">
          <label className="block">
            <span className="text-xs font-medium">メールアドレス</span>
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
              className="mt-1 w-full rounded border border-[var(--border)] px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium">パスワード</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="mt-1 w-full rounded border border-[var(--border)] px-2 py-1.5 text-sm"
            />
          </label>

          {state?.error && (
            <p className="rounded border border-crit-line bg-crit-bg px-2 py-1.5 text-xs text-crit-fg">
              ■ {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>

        <p className="mt-4 border-t border-[var(--border)] pt-3 text-xxs text-[var(--text-muted)]">
          デモ環境のログイン情報は README.md を参照してください。
        </p>
      </div>
    </main>
  );
}
