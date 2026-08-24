export interface Attribution {
  qrCodeId: number | null;
  salesUserId: string | null;
  shiftId: number | null;
  locationId: number | null;
  source: "qr" | "manual" | "direct";
}

export interface AttributionState extends Attribution {
  lockedAt: Date | null;
}

export const UNATTRIBUTED: Attribution = {
  qrCodeId: null,
  salesUserId: null,
  shiftId: null,
  locationId: null,
  source: "direct",
};

export function isAttributed(state: Attribution): boolean {
  return state.qrCodeId !== null && state.salesUserId !== null;
}

export interface AttributionDecision {
  attribution: Attribution;
  /** Whether the candidate row must be updated. */
  changed: boolean;
  reason: "first_attribution" | "already_attributed" | "locked" | "unchanged";
}

/**
 * First valid attribution wins.
 *
 * A candidate who scans several reps' QR codes still credits exactly one rep,
 * which is what stops the ledger from paying twice for one person. Admins can
 * still override deliberately via `overrideAttribution`.
 */
export function resolveAttribution(
  current: AttributionState,
  incoming: Attribution,
): AttributionDecision {
  if (current.lockedAt !== null) {
    return { attribution: current, changed: false, reason: "locked" };
  }
  if (isAttributed(current)) {
    if (current.qrCodeId === incoming.qrCodeId) {
      return { attribution: current, changed: false, reason: "unchanged" };
    }
    return { attribution: current, changed: false, reason: "already_attributed" };
  }
  if (!isAttributed(incoming)) {
    return { attribution: current, changed: false, reason: "unchanged" };
  }
  return { attribution: incoming, changed: true, reason: "first_attribution" };
}

/** Explicit admin correction; always wins, and is expected to be audit-logged. */
export function overrideAttribution(incoming: Attribution): Attribution {
  return { ...incoming, source: "manual" };
}
