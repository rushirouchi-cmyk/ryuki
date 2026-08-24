import 'server-only';
import { cookies } from 'next/headers';

export const CANDIDATE_COOKIE = 'cre_candidate';
const TTL_DAYS = 90;

export async function getCandidateIdFromCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(CANDIDATE_COOKIE)?.value ?? null;
}

export async function setCandidateCookie(candidateId: string): Promise<void> {
  const store = await cookies();
  store.set(CANDIDATE_COOKIE, candidateId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * TTL_DAYS,
  });
}
