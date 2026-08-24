import 'server-only';
import { cookies } from 'next/headers';
import { and, eq, gt } from 'drizzle-orm';
import { getDb, schema } from '@/db/client';
import type { Principal, Role } from '@/domain/auth/rbac';
import { verifyPassword } from './password';
import { generateToken } from './tokens';

export const SESSION_COOKIE = 'cre_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

export interface SessionUser extends Principal {
  email: string;
  displayName: string;
}

export async function login(
  email: string,
  password: string,
): Promise<{ ok: true; user: SessionUser } | { ok: false; error: string }> {
  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(schema.users.email, email.trim().toLowerCase()),
  });
  if (!user || !user.active) {
    return { ok: false, error: 'メールアドレスまたはパスワードが正しくありません。' };
  }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return { ok: false, error: 'メールアドレスまたはパスワードが正しくありません。' };
  }

  const sessionId = generateToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(schema.sessions).values({ id: sessionId, userId: user.id, expiresAt });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });

  return {
    ok: true,
    user: {
      userId: user.id,
      role: user.role as Role,
      agentCompanyId: user.agentCompanyId,
      email: user.email,
      displayName: user.displayName,
    },
  };
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (sessionId) {
    await getDb().delete(schema.sessions).where(eq(schema.sessions.id, sessionId));
  }
  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const db = getDb();
  const row = await db.query.sessions.findFirst({
    where: and(eq(schema.sessions.id, sessionId), gt(schema.sessions.expiresAt, new Date())),
    with: { },
  });
  if (!row) return null;

  const user = await db.query.users.findFirst({ where: eq(schema.users.id, row.userId) });
  if (!user || !user.active) return null;

  return {
    userId: user.id,
    role: user.role as Role,
    agentCompanyId: user.agentCompanyId,
    email: user.email,
    displayName: user.displayName,
  };
}
