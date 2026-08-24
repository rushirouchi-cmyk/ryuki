import { and, eq, gte, lte, sql } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { incentiveLedger, incentiveRules } from "@/lib/db/schema";
import {
  isIncentivisedEvent,
  selectApplicableRule,
  type IncentiveContext,
  type IncentiveEventType,
  type IncentiveRuleRow,
} from "./engine";

export interface AccrueIncentiveInput {
  salesUserId: string | null;
  candidateId: string;
  shiftId: number | null;
  eventType: string;
  occurredAt?: Date;
  context?: IncentiveContext;
}

export interface AccrueIncentiveResult {
  status: "accrued" | "duplicate" | "no_rule" | "not_attributed" | "not_incentivised";
  amountYen?: number;
  ruleId?: number;
}

async function loadRules(db: Database): Promise<IncentiveRuleRow[]> {
  const rows = await db
    .select()
    .from(incentiveRules)
    .where(eq(incentiveRules.active, true));

  return rows.map((row) => ({
    id: row.id,
    eventType: row.eventType as IncentiveEventType,
    amountYen: row.amountYen,
    validFrom: row.validFrom,
    validTo: row.validTo,
    active: row.active,
    conditions: (row.conditions as IncentiveRuleRow["conditions"]) ?? null,
    priority: row.priority,
  }));
}

/**
 * Writes at most one ledger row per (candidate, event type). The uniqueness is
 * enforced by a DB index, not by a read-then-write check, so concurrent funnel
 * updates cannot double-credit a sales rep.
 */
export async function accrueIncentive(
  db: Database,
  input: AccrueIncentiveInput,
): Promise<AccrueIncentiveResult> {
  if (!isIncentivisedEvent(input.eventType)) return { status: "not_incentivised" };
  if (!input.salesUserId) return { status: "not_attributed" };

  const occurredAt = input.occurredAt ?? new Date();
  const rules = await loadRules(db);
  const rule = selectApplicableRule(
    rules,
    input.eventType,
    occurredAt,
    input.context ?? {},
  );
  if (!rule) return { status: "no_rule" };

  const inserted = await db
    .insert(incentiveLedger)
    .values({
      salesUserId: input.salesUserId,
      candidateId: input.candidateId,
      shiftId: input.shiftId,
      eventType: input.eventType,
      amountYen: rule.amountYen,
      occurredAt,
      ruleId: rule.id,
      status: "pending",
    })
    .onConflictDoNothing({
      target: [incentiveLedger.candidateId, incentiveLedger.eventType],
    })
    .returning({ id: incentiveLedger.id });

  if (inserted.length === 0) return { status: "duplicate" };
  return { status: "accrued", amountYen: rule.amountYen, ruleId: rule.id };
}

export interface IncentiveTotals {
  pendingYen: number;
  approvedYen: number;
  paidYen: number;
  totalYen: number;
  entryCount: number;
}

export async function getIncentiveTotals(
  db: Database,
  salesUserId: string,
  from: Date,
  to: Date,
): Promise<IncentiveTotals> {
  const rows = await db
    .select({
      status: incentiveLedger.status,
      amount: sql<number>`coalesce(sum(${incentiveLedger.amountYen}), 0)::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(incentiveLedger)
    .where(
      and(
        eq(incentiveLedger.salesUserId, salesUserId),
        gte(incentiveLedger.occurredAt, from),
        lte(incentiveLedger.occurredAt, to),
      ),
    )
    .groupBy(incentiveLedger.status);

  const totals: IncentiveTotals = {
    pendingYen: 0,
    approvedYen: 0,
    paidYen: 0,
    totalYen: 0,
    entryCount: 0,
  };

  for (const row of rows) {
    if (row.status === "pending") totals.pendingYen += row.amount;
    if (row.status === "approved") totals.approvedYen += row.amount;
    if (row.status === "paid") totals.paidYen += row.amount;
    if (row.status !== "rejected") totals.totalYen += row.amount;
    totals.entryCount += row.count;
  }

  return totals;
}
