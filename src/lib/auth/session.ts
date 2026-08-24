import "server-only";
import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { agentCompanies, authSessions, users } from "@/lib/db/schema";
import { generateToken } from "@/lib/utils/token";
import { verifyPassword } from "./password";

export const SESSION_COOKIE = "ryuki_session";
export const CANDIDATE_COOKIE = "ryuki_candidate";

const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const CANDIDATE_TTL_SECONDS = 60 * 60 * 24 * 90;

export type Role = "admin" | "sales" | "agent";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  agentCompanyId: number | null;
  agentCompanyName: string | null;
}

export async function signIn(
  email: string,
  password: string,
): Promise<SessionUser | null> {
  const db = await getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);

  if (!user || !user.active) return null;
  if (!(await verifyPassword(password, user.passwordHash))) return null;

  const token = generateToken(24);
  await db.insert(authSessions).values({
    token,
    userId: user.id,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });

  return toSessionUser(user, null);
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.delete(authSessions).where(eq(authSessions.token, token));
  }
  store.delete(SESSION_COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const db = await getDb();
  const [row] = await db
    .select({ user: users, companyName: agentCompanies.name })
    .from(authSessions)
    .innerJoin(users, eq(authSessions.userId, users.id))
    .leftJoin(agentCompanies, eq(users.agentCompanyId, agentCompanies.id))
    .where(and(eq(authSessions.token, token), gt(authSessions.expiresAt, new Date())))
    .limit(1);

  if (!row || !row.user.active) return null;
  return toSessionUser(row.user, row.companyName);
}

function toSessionUser(
  user: typeof users.$inferSelect,
  companyName: string | null,
): SessionUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    agentCompanyId: user.agentCompanyId,
    agentCompanyName: companyName,
  };
}

/* -------------------------------------------------------------------------- */
/* Anonymous candidate identity                                               */
/* -------------------------------------------------------------------------- */

export async function getCandidateToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(CANDIDATE_COOKIE)?.value ?? null;
}

export async function setCandidateToken(token: string): Promise<void> {
  const store = await cookies();
  store.set(CANDIDATE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CANDIDATE_TTL_SECONDS,
  });
}
