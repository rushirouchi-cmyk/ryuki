export type Role = 'admin' | 'sales' | 'agent';

export interface Principal {
  userId: string;
  role: Role;
  agentCompanyId: string | null;
}

export class ForbiddenError extends Error {
  constructor(message = 'この操作を行う権限がありません。') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export function isAdmin(principal: Principal): boolean {
  return principal.role === 'admin';
}

/** Admins see every area; sales reps only ever see their own shifts. */
export function canReadShift(principal: Principal, shift: { salesUserId: string }): boolean {
  if (isAdmin(principal)) return true;
  return principal.role === 'sales' && shift.salesUserId === principal.userId;
}

export function canModifyShift(principal: Principal, shift: { salesUserId: string }): boolean {
  if (isAdmin(principal)) return true;
  return principal.role === 'sales' && shift.salesUserId === principal.userId;
}

/** Sales reps may only read incentive rows that belong to them. */
export function canReadIncentiveEntry(principal: Principal, entry: { salesUserId: string }): boolean {
  if (isAdmin(principal)) return true;
  return principal.role === 'sales' && entry.salesUserId === principal.userId;
}

/** Only admins approve, reject or pay incentives — never the earner. */
export function canApproveIncentive(principal: Principal): boolean {
  return isAdmin(principal);
}

/** An agent user may only touch referrals routed to their own company. */
export function canReadReferral(principal: Principal, referral: { agentCompanyId: string }): boolean {
  if (isAdmin(principal)) return true;
  return principal.role === 'agent' && principal.agentCompanyId === referral.agentCompanyId;
}

export function canUpdateReferral(principal: Principal, referral: { agentCompanyId: string }): boolean {
  return canReadReferral(principal, referral);
}

/**
 * PII is released to an agent only after the candidate consented to that
 * specific company, and only while the consent is live.
 */
export function canViewCandidatePii(
  principal: Principal,
  params: {
    candidateAgentCompanyId: string;
    consent: { agentCompanyId: string; revokedAt: Date | null } | null;
  },
): boolean {
  if (isAdmin(principal)) return true;
  if (principal.role !== 'agent') return false;
  if (principal.agentCompanyId !== params.candidateAgentCompanyId) return false;
  const consent = params.consent;
  return Boolean(consent && consent.agentCompanyId === principal.agentCompanyId && !consent.revokedAt);
}

export function canAccessAdminArea(principal: Principal): boolean {
  return isAdmin(principal);
}

export function canAccessSalesArea(principal: Principal): boolean {
  return principal.role === 'sales' || isAdmin(principal);
}

export function canAccessAgentArea(principal: Principal): boolean {
  return principal.role === 'agent' || isAdmin(principal);
}

export function assertPermission(allowed: boolean, message?: string): void {
  if (!allowed) throw new ForbiddenError(message);
}

export const ROLE_HOME: Record<Role, string> = {
  admin: '/admin',
  sales: '/sales',
  agent: '/agent',
};
