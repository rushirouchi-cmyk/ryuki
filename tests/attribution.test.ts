import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { candidateEvents, candidates, scanEvents } from "@/lib/db/schema";
import {
  resolveAttribution,
  overrideAttribution,
  UNATTRIBUTED,
  type Attribution,
} from "@/lib/domain/attribution/engine";
import { handleQrScan, startDiagnosis } from "@/lib/domain/candidates/service";
import { createTestDb } from "./helpers/db";
import { seedFixtures, type Fixtures } from "./helpers/fixtures";

const repA: Attribution = {
  qrCodeId: 1,
  salesUserId: "a",
  shiftId: 1,
  locationId: 1,
  source: "qr",
};
const repB: Attribution = {
  qrCodeId: 2,
  salesUserId: "b",
  shiftId: 2,
  locationId: 1,
  source: "qr",
};

describe("attribution rules", () => {
  it("takes the first valid attribution", () => {
    const decision = resolveAttribution({ ...UNATTRIBUTED, lockedAt: null }, repA);
    expect(decision.changed).toBe(true);
    expect(decision.reason).toBe("first_attribution");
    expect(decision.attribution.salesUserId).toBe("a");
  });

  it("never moves to a second rep's QR", () => {
    const decision = resolveAttribution({ ...repA, lockedAt: null }, repB);
    expect(decision.changed).toBe(false);
    expect(decision.reason).toBe("already_attributed");
    expect(decision.attribution.salesUserId).toBe("a");
  });

  it("treats a re-scan of the same QR as a no-op", () => {
    const decision = resolveAttribution({ ...repA, lockedAt: null }, repA);
    expect(decision.changed).toBe(false);
    expect(decision.reason).toBe("unchanged");
  });

  it("refuses to change a locked attribution", () => {
    const decision = resolveAttribution({ ...repA, lockedAt: new Date() }, repB);
    expect(decision.changed).toBe(false);
    expect(decision.reason).toBe("locked");
  });

  it("ignores an incoming attribution with no rep", () => {
    const decision = resolveAttribution(
      { ...UNATTRIBUTED, lockedAt: null },
      UNATTRIBUTED,
    );
    expect(decision.changed).toBe(false);
  });

  it("marks an admin override as manual", () => {
    expect(overrideAttribution(repB).source).toBe("manual");
  });
});

describe("QR scan handling", () => {
  let db: Database;
  let cleanup: () => void;
  let fixtures: Fixtures;

  beforeAll(async () => {
    ({ db, cleanup } = await createTestDb());
    fixtures = await seedFixtures(db);
  });

  afterAll(() => cleanup());

  it("links a new candidate to the rep, shift and location behind the QR", async () => {
    const outcome = await handleQrScan(db, fixtures.qrToken, null);
    expect(outcome).not.toBeNull();
    expect(outcome!.created).toBe(true);

    const [candidate] = await db
      .select()
      .from(candidates)
      .where(eq(candidates.id, outcome!.candidateId));

    expect(candidate?.salesUserId).toBe(fixtures.salesUserId);
    expect(candidate?.shiftId).toBe(fixtures.shiftId);
    expect(candidate?.locationId).toBe(fixtures.locationId);
    expect(candidate?.attributionSource).toBe("qr");
  });

  it("records a qr_scanned event exactly once for a new candidate", async () => {
    const outcome = await handleQrScan(db, fixtures.qrToken, null);
    const events = await db
      .select()
      .from(candidateEvents)
      .where(eq(candidateEvents.candidateId, outcome!.candidateId));
    expect(events.filter((event) => event.eventType === "qr_scanned")).toHaveLength(1);
  });

  it("keeps the first rep when the same person scans another rep's QR", async () => {
    const first = await handleQrScan(db, fixtures.qrToken, null);
    const second = await handleQrScan(db, fixtures.otherQrToken, first!.publicToken);

    expect(second!.created).toBe(false);
    expect(second!.candidateId).toBe(first!.candidateId);
    expect(second!.attributed).toBe(false);

    const [candidate] = await db
      .select()
      .from(candidates)
      .where(eq(candidates.id, first!.candidateId));
    expect(candidate?.salesUserId).toBe(fixtures.salesUserId);

    /* The second scan is still recorded, just not as the attributing one. */
    const scans = await db
      .select()
      .from(scanEvents)
      .where(eq(scanEvents.candidateId, first!.candidateId));
    expect(scans).toHaveLength(2);
    expect(scans.filter((scan) => scan.isAttributed)).toHaveLength(1);
  });

  it("does not create a second funnel entry on a repeat scan", async () => {
    const first = await handleQrScan(db, fixtures.qrToken, null);
    await handleQrScan(db, fixtures.qrToken, first!.publicToken);

    const events = await db
      .select()
      .from(candidateEvents)
      .where(eq(candidateEvents.candidateId, first!.candidateId));
    expect(events.filter((event) => event.eventType === "qr_scanned")).toHaveLength(1);
  });

  it("locks the attribution when the diagnosis starts", async () => {
    const outcome = await handleQrScan(db, fixtures.qrToken, null);
    await startDiagnosis(db, outcome!.candidateId);

    const [candidate] = await db
      .select()
      .from(candidates)
      .where(eq(candidates.id, outcome!.candidateId));
    expect(candidate?.attributionLockedAt).not.toBeNull();
  });

  it("rejects an unknown QR token", async () => {
    expect(await handleQrScan(db, "does-not-exist", null)).toBeNull();
  });
});
