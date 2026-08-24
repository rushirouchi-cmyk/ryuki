'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { ROLE_HOME } from '@/domain/auth/rbac';
import { login, logout } from '@/server/session';
import { writeAuditLog } from '@/server/audit';

const loginSchema = z.object({
  email: z.string().email('メールアドレスの形式が正しくありません'),
  password: z.string().min(1, 'パスワードを入力してください'),
});

export interface LoginState {
  error?: string;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '入力内容を確認してください' };
  }

  const result = await login(parsed.data.email, parsed.data.password);
  if (!result.ok) {
    return { error: result.error };
  }

  await writeAuditLog({
    actorUserId: result.user.userId,
    actorRole: result.user.role,
    action: 'login',
    entityType: 'user',
    entityId: result.user.userId,
  });

  redirect(ROLE_HOME[result.user.role]);
}

export async function logoutAction(): Promise<void> {
  await logout();
  redirect('/login');
}
