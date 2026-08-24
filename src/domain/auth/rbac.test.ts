import { describe, expect, it } from 'vitest';
import {
  assertPermission,
  canAccessAdminArea,
  canAccessAgentArea,
  canAccessSalesArea,
  canApproveIncentive,
  canModifyShift,
  canReadIncentiveEntry,
  canReadReferral,
  canReadShift,
  canViewCandidatePii,
  ForbiddenError,
  type Principal,
} from './rbac';
import { maskEmail, maskName, maskPhone, redactForAudit } from './pii';

const admin: Principal = { userId: 'admin-1', role: 'admin', agentCompanyId: null };
const salesA: Principal = { userId: 'sales-a', role: 'sales', agentCompanyId: null };
const salesB: Principal = { userId: 'sales-b', role: 'sales', agentCompanyId: null };
const agentA: Principal = { userId: 'agent-a', role: 'agent', agentCompanyId: 'company-a' };
const agentB: Principal = { userId: 'agent-b', role: 'agent', agentCompanyId: 'company-b' };

describe('shift permissions', () => {
  const shift = { salesUserId: 'sales-a' };

  it('lets a sales rep read and modify their own shift', () => {
    expect(canReadShift(salesA, shift)).toBe(true);
    expect(canModifyShift(salesA, shift)).toBe(true);
  });

  it('stops a sales rep from touching another rep shift', () => {
    expect(canReadShift(salesB, shift)).toBe(false);
    expect(canModifyShift(salesB, shift)).toBe(false);
  });

  it('lets an admin manage any shift', () => {
    expect(canModifyShift(admin, shift)).toBe(true);
  });

  it('stops an agent from touching sales data', () => {
    expect(canModifyShift(agentA, shift)).toBe(false);
  });
});

describe('incentive permissions', () => {
  it('scopes ledger reads to the earning rep', () => {
    expect(canReadIncentiveEntry(salesA, { salesUserId: 'sales-a' })).toBe(true);
    expect(canReadIncentiveEntry(salesB, { salesUserId: 'sales-a' })).toBe(false);
  });

  it('never lets the earner approve their own incentive', () => {
    expect(canApproveIncentive(salesA)).toBe(false);
    expect(canApproveIncentive(admin)).toBe(true);
  });
});

describe('referral permissions', () => {
  const referral = { agentCompanyId: 'company-a' };

  it('lets an agent read their own company referrals', () => {
    expect(canReadReferral(agentA, referral)).toBe(true);
  });

  it('stops an agent from reading another company referrals', () => {
    expect(canReadReferral(agentB, referral)).toBe(false);
  });

  it('stops a sales rep from reading referrals', () => {
    expect(canReadReferral(salesA, referral)).toBe(false);
  });
});

describe('candidate PII gating', () => {
  const liveConsent = { agentCompanyId: 'company-a', revokedAt: null };

  it('releases PII only after consent for that exact company', () => {
    expect(
      canViewCandidatePii(agentA, { candidateAgentCompanyId: 'company-a', consent: liveConsent }),
    ).toBe(true);
  });

  it('withholds PII when no consent exists', () => {
    expect(canViewCandidatePii(agentA, { candidateAgentCompanyId: 'company-a', consent: null })).toBe(false);
  });

  it('withholds PII once consent is revoked', () => {
    expect(
      canViewCandidatePii(agentA, {
        candidateAgentCompanyId: 'company-a',
        consent: { agentCompanyId: 'company-a', revokedAt: new Date() },
      }),
    ).toBe(false);
  });

  it('withholds PII from another agent even with a consent on file', () => {
    expect(
      canViewCandidatePii(agentB, { candidateAgentCompanyId: 'company-a', consent: liveConsent }),
    ).toBe(false);
  });
});

describe('area access', () => {
  it('restricts each console to its role', () => {
    expect(canAccessAdminArea(admin)).toBe(true);
    expect(canAccessAdminArea(salesA)).toBe(false);
    expect(canAccessAdminArea(agentA)).toBe(false);

    expect(canAccessSalesArea(salesA)).toBe(true);
    expect(canAccessSalesArea(agentA)).toBe(false);

    expect(canAccessAgentArea(agentA)).toBe(true);
    expect(canAccessAgentArea(salesA)).toBe(false);
  });
});

describe('assertPermission', () => {
  it('throws a ForbiddenError when denied', () => {
    expect(() => assertPermission(false)).toThrow(ForbiddenError);
    expect(() => assertPermission(true)).not.toThrow();
  });
});

describe('PII masking', () => {
  it('masks contact details', () => {
    expect(maskEmail('taro.yamada@example.com')).toBe('t**********@example.com');
    expect(maskPhone('090-1234-5678')).toBe('*******5678');
    expect(maskName('山本 大輝')).toBe('山****');
  });

  it('handles missing values', () => {
    expect(maskEmail(null)).toBe('—');
    expect(maskPhone(undefined)).toBe('—');
    expect(maskName('')).toBe('—');
  });

  it('redacts PII before it reaches the audit log', () => {
    const redacted = redactForAudit({ email: 'a@b.com', phone: '09012345678', shiftId: 's1' });
    expect(redacted).toEqual({ email: '[redacted]', phone: '[redacted]', shiftId: 's1' });
  });
});
