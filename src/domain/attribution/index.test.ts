import { describe, expect, it } from 'vitest';
import { overrideAttribution, resolveAttribution, type AttributionSource } from './index';

const repA: AttributionSource = {
  qrCodeId: 'qr-a',
  salesUserId: 'sales-a',
  shiftId: 'shift-a',
  locationId: 'location-a',
};

const repB: AttributionSource = {
  qrCodeId: 'qr-b',
  salesUserId: 'sales-b',
  shiftId: 'shift-b',
  locationId: 'location-b',
};

describe('resolveAttribution', () => {
  it('binds QR, sales rep, shift and location on the first scan', () => {
    const decision = resolveAttribution(null, repA);
    expect(decision).toEqual({
      action: 'create',
      value: { ...repA, source: 'qr' },
    });
  });

  it('keeps the first owner when the candidate scans another rep QR later', () => {
    const decision = resolveAttribution(
      { candidateId: 'c1', source: 'qr', attributedAt: new Date(), ...repA },
      repB,
    );
    expect(decision).toEqual({ action: 'keep', reason: 'already_attributed' });
  });

  it('is idempotent when the same QR is scanned twice', () => {
    const decision = resolveAttribution(
      { candidateId: 'c1', source: 'qr', attributedAt: new Date(), ...repA },
      repA,
    );
    expect(decision.action).toBe('keep');
  });
});

describe('overrideAttribution', () => {
  it('records who changed it and why', () => {
    const value = overrideAttribution({ target: repB, adminUserId: 'admin-1', reason: '現地確認のため' });
    expect(value).toMatchObject({
      ...repB,
      source: 'admin_override',
      overriddenByUserId: 'admin-1',
      overrideReason: '現地確認のため',
    });
  });

  it('refuses an override without a reason so the audit trail stays usable', () => {
    expect(() => overrideAttribution({ target: repB, adminUserId: 'admin-1', reason: '   ' })).toThrow();
  });
});
