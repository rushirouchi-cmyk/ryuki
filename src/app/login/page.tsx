import { redirect } from 'next/navigation';
import { ROLE_HOME } from '@/domain/auth/rbac';
import { getCurrentUser } from '@/server/session';
import { LoginForm } from './login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect(ROLE_HOME[user.role]);
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <p className="text-xs font-semibold tracking-widest text-brand-600">CAREER ROUTING ENGINE</p>
        <h1 className="mt-2 mb-6 text-xl font-bold text-ink-900">ログイン</h1>
        {error === 'forbidden' && (
          <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            この画面を表示する権限がありません。別のアカウントでログインしてください。
          </p>
        )}
        <LoginForm />
      </div>
      <p className="mt-6 text-center text-xs leading-relaxed text-ink-500">
        検証用アカウント: admin@example.com / sales1@example.com / agent1@example.com
        <br />
        パスワードは <code className="rounded bg-slate-200 px-1">.env</code> の SEED_PASSWORD
      </p>
    </main>
  );
}
