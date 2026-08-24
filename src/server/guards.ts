import 'server-only';
import { redirect } from 'next/navigation';
import { ForbiddenError, type Role } from '@/domain/auth/rbac';
import { getCurrentUser, type SessionUser } from './session';

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    redirect('/login?error=forbidden');
  }
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  return requireRole('admin');
}

export async function requireSales(): Promise<SessionUser> {
  return requireRole('sales', 'admin');
}

export async function requireAgent(): Promise<SessionUser> {
  return requireRole('agent', 'admin');
}

export function assertOrThrow(condition: boolean, message?: string): asserts condition {
  if (!condition) throw new ForbiddenError(message);
}
