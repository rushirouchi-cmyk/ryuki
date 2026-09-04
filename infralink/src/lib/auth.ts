import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import type { Role } from '@/lib/domain/enums';

/**
 * 認証 (§39)。
 * - パスワードは bcrypt でハッシュ化して保存し、平文は一切保持しない。
 * - セッションは HMAC 署名付き JWT を httpOnly / SameSite=Lax Cookie で保持。
 * - 署名鍵は AUTH_SECRET (環境変数) から取得し、コードには埋め込まない (§41)。
 */

const COOKIE_NAME = 'infralink_session';

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    throw new Error('AUTH_SECRET が未設定、または 32 文字未満です。.env を確認してください。');
  }
  return new TextEncoder().encode(value);
}

function maxAgeSeconds() {
  const hours = Number(process.env.SESSION_MAX_AGE_HOURS ?? 12);
  return (Number.isFinite(hours) && hours > 0 ? hours : 12) * 3600;
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export async function verifyCredentials(email: string, password: string): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || !user.active) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role as Role };
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({ name: user.name, email: user.email, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds()}s`)
    .sign(secret());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeconds(),
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** 現在のセッションユーザー。未ログインなら null。 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    // 失効・権限変更を反映するため DB を都度確認する。
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.active) return null;
    return { id: user.id, name: user.name, email: user.email, role: user.role as Role };
  } catch {
    return null;
  }
}

/** ページ/Server Action で使う。未ログインなら例外。 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error('UNAUTHENTICATED');
  return user;
}
