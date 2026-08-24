import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { candidateContacts, consents, referrals, shifts } from "@/lib/db/schema";
import {
  assertAgentScope,
  assertSalesScope,
  ForbiddenError,
  homeFor,
} from "@/lib/auth/guards";
import { redactPii } from "@/lib/auth/audit";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import type { SessionUser } from "@/lib/auth/session";
import {
  getAgentReferral,
  hasConsent,
  referCandidate,
} from "@/lib/domain/agents/service";
import { loadAgentCandidate } from "@/lib/domain/agents/views";
import { handleQrScan, registerLead } from "@/lib/domain/candidates/service";
import { createTestDb } from "./helpers/db";
import { seedFixtures, type Fixtures } from "./helpers/fixtures";

function user(overrides: Partial<SessionUser>): SessionUser {
  return {
    id: "user-1",
    email: "user@test.local",
    name: "テスト",
    role: "sales",
    agentCompanyId: null,
    agentCompanyName: null,
    ...overrides,
  };
}

describe("role scoping", () => {
  it("sends each role to its own home", () => {
    expect(homeFor("admin")).toBe("/admin");
    expect(homeFor("sales")).toBe("/sales");
    expect(homeFor("agent")).toBe("/agent");
  });

  it("stops a sales user from touching another rep's data", () => {
    const rep = user({ id: "rep-a", role: "sales" });
    expect(() => assertSalesScope(rep, "rep-a")).not.toThrow();
    expect(() => assertSalesScope(rep, "rep-b")).toThrow(ForbiddenError);
  });

  it("stops an agent from acting on another agency's candidate", () => {
    const agent = user({ role: "agent", agentCompanyId: 1 });
    expect(() => assertAgentScope(agent, 1)).not.toThrow();
    expect(() => assertAgentScope(agent, 2)).toThrow(ForbiddenError);
  });

  it("stops a sales user from reaching agent data at all", () => {
    expect(() => assertAgentScope(user({ role: "sales" }), 1)).toThrow(ForbiddenError);
  });

  it("lets an admin cross both scopes", () => {
    const admin = user({ role: "admin" });
    expect(() => assertSalesScope(admin, "anyone")).not.toThrow();
    expect(() => assertAgentScope(admin, 999)).not.toThrow();
  });
});

describe("credentials and logging", () => {
  it("never stores a password in the clear and rejects a wrong one", async () => {
    const hash = await hashPassword("correct horse");
    expect(hash).not.toContain("correct horse");
    expect(await verifyPassword("correct horse", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("rejects a malformed stored hash instead of accepting anything", async () => {
    expect(await verifyPassword("x", "not-a-hash")).toBe(false);
    expect(await verifyPassword("x", "")).toBe(false);
  });

  it("keeps contact details out of audit metadata", () => {
    const redacted = redactPii({
      email: "taro@example.com",
      phone: "090-0000-0000",
      fullName: "テスト 太郎",
      referralId: 12,
    });
    expect(redacted.email).toBe("[redacted]");
    expect(redacted.phone).toBe("[redacted]");
    expect(redacted.fullName).toBe("[redacted]");
    expect(redacted.referralId).toBe(12);
  });
});

describe("agent data isolation", () => {
  let db: Database;
  let cleanup: () => void;
  let fixtures: Fixtures;
  let referralId: number;
  let candidateId: string;

  beforeAll(async () => {
    ({ db, cleanup } = await createTestDb());
    fixtures = await seedFixtures(db);

    const scan = await handleQrScan(db, fixtures.qrToken, null);
    candidateId = scan!.candidateId;
    await registerLead(db, candidateId, {
      fullName: "テスト 太郎",
      email: "taro@example.com",
      phone: "090-1111-2222",
    });
    const created = await referCandidate(db, candidateId, [fixtures.agentCompanyId]);
    referralId = created[0]!;
  }, 120_000);

  afterAll(() => cleanup());

  it("returns the referral to its owning agency", async () => {
    const referral = await getAgentReferral(db, fixtures.agentCompanyId, referralId);
    expect(referral?.id).toBe(referralId);
  });

  it("hides the referral from every other agency", async () => {
    const referral = await getAgentReferral(db, fixtures.otherAgentCompanyId, referralId);
    expect(referral).toBeNull();
    expect(
      await loadAgentCandidate(db, fixtures.otherAgentCompanyId, referralId),
    ).toBeNull();
  });

  it("records consent for exactly the agency the candidate chose", async () => {
    expect(await hasConsent(db, candidateId, fixtures.agentCompanyId)).toBe(true);
    expect(await hasConsent(db, candidateId, fixtures.otherAgentCompanyId)).toBe(false);

    const rows = await db
      .select()
      .from(consents)
      .where(eq(consents.candidateId, candidateId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.agentCompanyId).toBe(fixtures.agentCompanyId);
    expect(rows[0]?.consentedAt).toBeInstanceOf(Date);
    expect(rows[0]?.contentVersion).toBeTruthy();
    expect(rows[0]?.consentText.length).toBeGreaterThan(0);
  });

  it("shows contact details to the consented agency", async () => {
    const card = await loadAgentCandidate(db, fixtures.agentCompanyId, referralId);
    expect(card?.contact?.email).toBe("taro@example.com");
    expect(card?.contact?.phone).toBe("090-1111-2222");
  });

  it("cannot delete a consent that a referral was made under", async () => {
    /* The referral -> consent foreign key is what makes the consent record
     * evidence rather than a mutable flag. */
    await expect(
      db.delete(consents).where(eq(consents.candidateId, candidateId)),
    ).rejects.toThrow();
  });

  it("withholds contact details once the candidate revokes consent", async () => {
    await db
      .update(consents)
      .set({ revokedAt: new Date() })
      .where(eq(consents.candidateId, candidateId));

    expect(await hasConsent(db, candidateId, fixtures.agentCompanyId)).toBe(false);

    const card = await loadAgentCandidate(db, fixtures.agentCompanyId, referralId);
    expect(card).not.toBeNull();
    expect(card?.contact).toBeNull();
    expect(card?.age).toBeNull();
    /* Non-identifying diagnosis data is still useful and still shown. */
    expect(card?.matchRank !== undefined).toBe(true);

    const [contact] = await db
      .select()
      .from(candidateContacts)
      .where(eq(candidateContacts.candidateId, candidateId));
    expect(contact?.email).toBe("taro@example.com");
  });

  it("never creates a duplicate referral for the same agency", async () => {
    const again = await referCandidate(db, candidateId, [fixtures.agentCompanyId]);
    expect(again).toEqual([]);

    const rows = await db
      .select()
      .from(referrals)
      .where(eq(referrals.candidateId, candidateId));
    expect(rows).toHaveLength(1);
  });
});

describe("shift ownership", () => {
  let db: Database;
  let cleanup: () => void;
  let fixtures: Fixtures;

  beforeAll(async () => {
    ({ db, cleanup } = await createTestDb());
    fixtures = await seedFixtures(db);
  }, 120_000);

  afterAll(() => cleanup());

  it("guards a counter update against the wrong rep", async () => {
    const [shift] = await db
      .select()
      .from(shifts)
      .where(eq(shifts.id, fixtures.shiftId));

    const owner = user({ id: fixtures.salesUserId, role: "sales" });
    const stranger = user({ id: fixtures.otherSalesUserId, role: "sales" });

    expect(() => assertSalesScope(owner, shift!.salesUserId)).not.toThrow();
    expect(() => assertSalesScope(stranger, shift!.salesUserId)).toThrow(ForbiddenError);
  });
});
