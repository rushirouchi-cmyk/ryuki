export interface AttributionSource {
  qrCodeId: string;
  salesUserId: string;
  shiftId: string;
  locationId: string;
}

export interface ExistingAttribution extends Partial<AttributionSource> {
  candidateId: string;
  source: string;
  attributedAt: Date;
}

export type AttributionDecision =
  | { action: 'create'; value: AttributionSource & { source: 'qr' } }
  | { action: 'keep'; reason: 'already_attributed' };

/**
 * First valid attribution wins. A candidate who scans a second rep's QR code
 * keeps their original acquisition owner, so no two reps can be paid for the
 * same person. Admins can still override via `overrideAttribution`.
 */
export function resolveAttribution(
  existing: ExistingAttribution | null,
  incoming: AttributionSource,
): AttributionDecision {
  if (existing) {
    return { action: 'keep', reason: 'already_attributed' };
  }
  return { action: 'create', value: { ...incoming, source: 'qr' } };
}

export interface AttributionOverride extends AttributionSource {
  source: 'admin_override';
  overriddenByUserId: string;
  overrideReason: string;
}

export function overrideAttribution(params: {
  target: AttributionSource;
  adminUserId: string;
  reason: string;
}): AttributionOverride {
  if (!params.reason.trim()) {
    throw new Error('Attribution overrides require a reason for the audit log.');
  }
  return {
    ...params.target,
    source: 'admin_override',
    overriddenByUserId: params.adminUserId,
    overrideReason: params.reason.trim(),
  };
}
