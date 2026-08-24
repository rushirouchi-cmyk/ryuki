import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { incentiveLedger, incentiveRules } from "@/lib/db/schema";
import {
  conditionsSatisfied,
  isRuleInEffect,
  selectApplicableRule,
  type IncentiveRuleRow,
} from "@/lib/domain/incentive/engine";
import { accrueIncentive, getIncentiveTotals } from "@/lib/domain/incentive/service";
import { handleQrScan } from "@/lib/domain/candidates/service";
import { emitCandidateEvent } from "@/lib/domain/events/service";
import { createTestDb } from "./helpers/db";
import { seedFixtures, type Fixtures } from "./helpers/fixtures";

function rule(overrides: Partial<IncentiveRuleRow> = {}): IncentiveRuleRow {
  return {
    id: 1,
    eventType: "lead_registered",
    amountYen: 800,
    validFrom: "2026-01-01",
    validTo: null,
    active: true,
    conditions: null,
    priority: 100,
    ...overrides,
  };
}

describe("incentive rule selection", () => {
  const inside = new Date("2026-06-15T03:00:00Z");

  it("honours the validity window", () => {
    expect(isRuleInEffect(rule(), inside)).toBe(true);
    expect(isRuleInEffect(rule({ validFrom: "2026-07-01" }), inside)).toBe(false);
    expect(isRuleInEffect(rule({ validTo: "2026-05-31" }), inside)).toBe(false);
    expect(isRuleInEffect(rule({ validTo: "2026-06-15" }), inside)).toBe(true);
  });

  it("ignores inactive rules", () => {
    expect(isRuleInEffect(rule({ active: false }), inside)).toBe(false);
    expect(selectApplicableRule([rule({ active: false })], "lead_registered", inside, {}))
      .toBeNull();
  });

  it("evaluates the minimum match rank condition", () => {
    const conditions = { minMatchRank: "B" as const };
    expect(conditionsSatisfied(conditions, { matchRank: "A" }, inside)).toBe(true);
    expect(conditionsSatisfied(conditions, { matchRank: "B" }, inside)).toBe(true);
    expect(conditionsSatisfied(conditions, { matchRank: "C" }, inside)).toBe(false);
    expect(conditionsSatisfied(conditions, {}, inside)).toBe(false);
  });

  it("evaluates venue and salary conditions", () => {
    expect(
      conditionsSatisfied({ venueTypes: ["station"] }, { venueType: "station" }, inside),
    ).toBe(true);
    expect(
      conditionsSatisfied(
        { venueTypes: ["station"] },
        { venueType: "shopping_mall" },
        inside,
      ),
    ).toBe(false);
    expect(
      conditionsSatisfied(
        { minCurrentSalaryYen: 4_000_000 },
        { currentSalaryYen: 3_500_000 },
        inside,
      ),
    ).toBe(false);
  });

  it("prefers the lowest priority, then the larger amount", () => {
    const selected = selectApplicableRule(
      [
        rule({ id: 1, priority: 100, amountYen: 800 }),
        rule({ id: 2, priority: 10, amountYen: 500 }),
        rule({ id: 3, priority: 10, amountYen: 900 }),
      ],
      "lead_registered",
      inside,
      {},
    );
    expect(selected?.id).toBe(3);
  });

  it("returns nothing for an event with no rule", () => {
    expect(selectApplicableRule([rule()], "joined", inside, {})).toBeNull();
  });
});

describe("incentive accrual", () => {
  let db: Database;
  let cleanup: () => void;
  let fixtures: Fixtures;

  beforeAll(async () => {
    ({ db, cleanup } = await createTestDb());
    fixtures = await seedFixtures(db);
  });

  afterAll(() => cleanup());

  async function newCandidate(): Promise<string> {
    const outcome = await handleQrScan(db, fixtures.qrToken, null);
    if (!outcome) throw new Error("scan failed");
    return outcome.candidateId;
  }

  it("credits the attributed rep the rule amount", async () => {
    const candidateId = await newCandidate();
    const result = await accrueIncentive(db, {
      salesUserId: fixtures.salesUserId,
      candidateId,
      shiftId: fixtures.shiftId,
      eventType: "lead_registered",
    });

    expect(result.status).toBe("accrued");
    expect(result.amountYen).toBe(800);

    const [entry] = await db
      .select()
      .from(incentiveLedger)
      .where(eq(incentiveLedger.candidateId, candidateId));
    expect(entry?.salesUserId).toBe(fixtures.salesUserId);
    expect(entry?.status).toBe("pending");
  });

  it("never credits the same candidate event twice", async () => {
    const candidateId = await newCandidate();
    const first = await accrueIncentive(db, {
      salesUserId: fixtures.salesUserId,
      candidateId,
      shiftId: fixtures.shiftId,
      eventType: "lead_registered",
    });
    const second = await accrueIncentive(db, {
      salesUserId: fixtures.salesUserId,
      candidateId,
      shiftId: fixtures.shiftId,
      eventType: "lead_registered",
    });

    expect(first.status).toBe("accrued");
    expect(second.status).toBe("duplicate");

    const entries = await db
      .select()
      .from(incentiveLedger)
      .where(
        and(
          eq(incentiveLedger.candidateId, candidateId),
          eq(incentiveLedger.eventType, "lead_registered"),
        ),
      );
    expect(entries).toHaveLength(1);
  });

  it("does not let a second rep claim the same candidate event", async () => {
    const candidateId = await newCandidate();
    await accrueIncentive(db, {
      salesUserId: fixtures.salesUserId,
      candidateId,
      shiftId: fixtures.shiftId,
      eventType: "lead_registered",
    });
    const poached = await accrueIncentive(db, {
      salesUserId: fixtures.otherSalesUserId,
      candidateId,
      shiftId: fixtures.otherShiftId,
      eventType: "lead_registered",
    });

    expect(poached.status).toBe("duplicate");
    const entries = await db
      .select()
      .from(incentiveLedger)
      .where(
        and(
          eq(incentiveLedger.candidateId, candidateId),
          eq(incentiveLedger.eventType, "lead_registered"),
        ),
      );
    expect(entries).toHaveLength(1);
    expect(entries[0]?.salesUserId).toBe(fixtures.salesUserId);
  });

  it("pays nothing for a QR scan", async () => {
    const candidateId = await newCandidate();
    const result = await accrueIncentive(db, {
      salesUserId: fixtures.salesUserId,
      candidateId,
      shiftId: fixtures.shiftId,
      eventType: "qr_scanned",
    });
    expect(result.status).toBe("not_incentivised");
  });

  it("pays nothing for an unattributed candidate", async () => {
    const candidateId = await newCandidate();
    const result = await accrueIncentive(db, {
      salesUserId: null,
      candidateId,
      shiftId: null,
      eventType: "lead_registered",
    });
    expect(result.status).toBe("not_attributed");
  });

  it("pays nothing when no rule is in effect for the event", async () => {
    const candidateId = await newCandidate();
    const result = await accrueIncentive(db, {
      salesUserId: fixtures.salesUserId,
      candidateId,
      shiftId: fixtures.shiftId,
      eventType: "joined",
    });
    expect(result.status).toBe("no_rule");
  });

  it("stops paying once a rule's window has closed", async () => {
    await db
      .update(incentiveRules)
      .set({ validTo: "2026-01-02" })
      .where(eq(incentiveRules.eventType, "agent_referred"));

    const candidateId = await newCandidate();
    const result = await accrueIncentive(db, {
      salesUserId: fixtures.salesUserId,
      candidateId,
      shiftId: fixtures.shiftId,
      eventType: "agent_referred",
      occurredAt: new Date("2026-06-01T00:00:00Z"),
    });
    expect(result.status).toBe("no_rule");

    const backdated = await accrueIncentive(db, {
      salesUserId: fixtures.salesUserId,
      candidateId,
      shiftId: fixtures.shiftId,
      eventType: "agent_referred",
      occurredAt: new Date("2026-01-01T00:00:00Z"),
    });
    expect(backdated.status).toBe("accrued");
  });

  it("accrues automatically when a funnel event is emitted", async () => {
    const candidateId = await newCandidate();
    await emitCandidateEvent(db, { candidateId, eventType: "diagnosis_completed" });

    const [entry] = await db
      .select()
      .from(incentiveLedger)
      .where(
        and(
          eq(incentiveLedger.candidateId, candidateId),
          eq(incentiveLedger.eventType, "diagnosis_completed"),
        ),
      );
    expect(entry?.amountYen).toBe(200);
  });

  it("excludes rejected entries from a rep's total", async () => {
    const candidateId = await newCandidate();
    await accrueIncentive(db, {
      salesUserId: fixtures.salesUserId,
      candidateId,
      shiftId: fixtures.shiftId,
      eventType: "lead_registered",
    });

    const before = await getIncentiveTotals(
      db,
      fixtures.salesUserId,
      new Date(2000, 0, 1),
      new Date(2100, 0, 1),
    );
    await db
      .update(incentiveLedger)
      .set({ status: "rejected" })
      .where(eq(incentiveLedger.candidateId, candidateId));
    const after = await getIncentiveTotals(
      db,
      fixtures.salesUserId,
      new Date(2000, 0, 1),
      new Date(2100, 0, 1),
    );

    expect(after.totalYen).toBe(before.totalYen - 800);
  });

  it("moves an entry through approval states", async () => {
    const candidateId = await newCandidate();
    await accrueIncentive(db, {
      salesUserId: fixtures.salesUserId,
      candidateId,
      shiftId: fixtures.shiftId,
      eventType: "lead_registered",
    });

    await db
      .update(incentiveLedger)
      .set({ status: "approved", approvedAt: new Date() })
      .where(eq(incentiveLedger.candidateId, candidateId));

    const totals = await getIncentiveTotals(
      db,
      fixtures.salesUserId,
      new Date(2000, 0, 1),
      new Date(2100, 0, 1),
    );
    expect(totals.approvedYen).toBeGreaterThanOrEqual(800);
  });
});
