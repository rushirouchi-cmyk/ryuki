'use server';

import { redirect } from 'next/navigation';
import { createSession, destroySession, verifyCredentials } from '@/lib/auth';
import { writeAudit } from '@/lib/audit';

export async function loginAction(_prev: { error?: string } | undefined, formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return { error: 'メールアドレスとパスワードを入力してください。' };

  const user = await verifyCredentials(email, password);
  if (!user) {
    // 存在しないアカウントとパスワード誤りを区別しない (アカウント列挙の防止)。
    return { error: 'メールアドレスまたはパスワードが正しくありません。' };
  }

  await createSession(user);
  await writeAudit({
    actor: { type: 'human', id: user.id, label: user.name },
    entityType: 'session',
    entityId: user.id,
    action: 'create',
    after: { email: user.email },
  });
  redirect('/');
}

export async function logoutAction() {
  await destroySession();
  redirect('/login');
}
