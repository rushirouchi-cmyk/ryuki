import 'server-only';
import { and, eq } from 'drizzle-orm';
import { getDb, schema } from '@/db/client';
import { evaluateIncentive } from '@/domain/incentive/engine';
import type { IncentiveRule, MonetizableEvent } from '@/domain/incentive/types';
import { getIncentiveConfig } from '@/server/settings';

type CandidateEventType = (typeof schema.candidateEventTypeEnum.enumValues)[number];

const MONETIZABLE: ReadonlySet<string> = new Set(schema.monetizableEventEnum.enumValues);

function asMonetizable(eventType: CandidateEventType): MonetizableEvent | null {
  return MONETIZABLE.has(eventType) ? (eventType as MonetizableEvent) : null;
}

export interface RecordEventParams {
  candidateId: string;
  eventType: CandidateEventType;
  userId?: string | null;
  agentCompanyId?: string | null;
  metadata?: Record<string, unknown>;
  occurredAt?: Date;
  /** scoring context used by conditional incentive rules */
  matchScore?: number | null;
  marketValueScore?: number | null;
  qualified?: boolean;
}

/**
 * Single write path for the funnel. Every stage transition goes through here so
 * that candidate_events stays the source of truth for analytics, and so that
 * incentives are evaluated exactly once per (candidate, event).
 */
export async function recordCandidateEvent(params: RecordEventParams): Promise<void> {
  const db = getDb();
  const attribution = await db.query.candidateAttributions.findFirst({
    where: eq(schema.candidateAttributions.candidateId, params.candidateId),
  });

  await db.insert(schema.candidateEvents).values({
    candidateId: params.candidateId,
    eventType: params.eventType,
    userId: params.userId ?? attribution?.salesUserId ?? null,
    shiftId: attribution?.shiftId ?? null,
    locationId: attribution?.locationId ?? null,
    agentCompanyId: params.agentCompanyId ?? null,
    metadata: params.metadata ?? {},
    createdAt: params.occurredAt ?? new Date(),
  });

  const monetizable = asMonetizable(params.eventType);
  if (!monetizable || !attribution?.salesUserId) return;

  const shift = attribution.shiftId
    ? await db.query.shifts.findFirst({ where: eq(schema.shifts.id, attribution.shiftId) })
    : undefined;

  const rules = await db.query.incentiveRules.findMany({
    where: and(
      eq(schema.incentiveRules.eventType, monetizable),
      eq(schema.incentiveRules.active, true),
    ),
  });

  const existing = await db.query.incentiveLedger.findMany({
    where: eq(schema.incentiveLedger.candidateId, params.candidateId),
  });

  const decision = evaluateIncentive(
    {
      candidateId: params.candidateId,
      salesUserId: attribution.salesUserId,
      shiftId: attribution.shiftId ?? null,
      eventType: monetizable,
      occurredAt: params.occurredAt ?? new Date(),
      matchScore: params.matchScore ?? null,
      marketValueScore: params.marketValueScore ?? null,
      venueType: shift?.venueType ?? null,
      qualified: params.qualified ?? false,
    },
    rules.map(
      (rule): IncentiveRule => ({
        id: rule.id,
        eventType: rule.eventType,
        amount: rule.amount,
        validFrom: rule.validFrom,
        validTo: rule.validTo,
        active: rule.active,
        conditions: rule.conditions,
      }),
    ),
    existing.map((entry) => ({ candidateId: entry.candidateId, eventType: entry.eventType })),
  );

  if (!decision.awarded) return;

  const config = await getIncentiveConfig();
  await db
    .insert(schema.incentiveLedger)
    .values({
      salesUserId: decision.salesUserId,
      candidateId: decision.candidateId,
      shiftId: decision.shiftId,
      eventType: decision.eventType,
      amount: decision.amount,
      ruleId: decision.ruleId,
      status: config.defaultStatus,
      occurredAt: decision.occurredAt,
    })
    // The unique index on (candidate_id, event_type) is the last line of
    // defence against double counting under concurrency.
    .onConflictDoNothing();
}
