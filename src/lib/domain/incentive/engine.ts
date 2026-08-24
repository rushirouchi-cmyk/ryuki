import type { MatchRank } from "@/lib/domain/diagnosis/types";

export const INCENTIVE_EVENT_TYPES = [
  "diagnosis_completed",
  "lead_registered",
  "interview_booked",
  "interview_completed",
  "candidate_qualified",
  "agent_referred",
  "offer",
  "joined",
] as const;

export type IncentiveEventType = (typeof INCENTIVE_EVENT_TYPES)[number];

/**
 * QR scans deliberately have no rule: paying per scan rewards volume over
 * quality, which is exactly the failure mode street acquisition is prone to.
 */
export const NON_INCENTIVISED_EVENTS = ["qr_scanned", "diagnosis_started"] as const;

export interface IncentiveRuleRow {
  id: number;
  eventType: IncentiveEventType;
  amountYen: number;
  validFrom: string;
  validTo: string | null;
  active: boolean;
  conditions: IncentiveConditions | null;
  priority: number;
}

/** Optional extra predicates evaluated against the funnel context. */
export interface IncentiveConditions {
  minMatchRank?: MatchRank;
  venueTypes?: string[];
  minCurrentSalaryYen?: number;
  weekdays?: number[];
}

export interface IncentiveContext {
  matchRank?: MatchRank | null;
  venueType?: string | null;
  currentSalaryYen?: number | null;
}

const RANK_ORDER: Record<MatchRank, number> = { C: 0, B: 1, A: 2, S: 3 };

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function isRuleInEffect(rule: IncentiveRuleRow, occurredAt: Date): boolean {
  if (!rule.active) return false;
  const day = toDateOnly(occurredAt);
  if (day < rule.validFrom) return false;
  if (rule.validTo !== null && day > rule.validTo) return false;
  return true;
}

export function conditionsSatisfied(
  conditions: IncentiveConditions | null,
  context: IncentiveContext,
  occurredAt: Date,
): boolean {
  if (!conditions) return true;

  if (conditions.minMatchRank) {
    if (!context.matchRank) return false;
    if (RANK_ORDER[context.matchRank] < RANK_ORDER[conditions.minMatchRank]) return false;
  }
  if (conditions.venueTypes && conditions.venueTypes.length > 0) {
    if (!context.venueType || !conditions.venueTypes.includes(context.venueType)) {
      return false;
    }
  }
  if (typeof conditions.minCurrentSalaryYen === "number") {
    if ((context.currentSalaryYen ?? 0) < conditions.minCurrentSalaryYen) return false;
  }
  if (conditions.weekdays && conditions.weekdays.length > 0) {
    if (!conditions.weekdays.includes(occurredAt.getDay())) return false;
  }
  return true;
}

/**
 * Lowest `priority` wins, then the larger amount. Returning `null` simply means
 * the event earns nothing right now — never an error.
 */
export function selectApplicableRule(
  rules: readonly IncentiveRuleRow[],
  eventType: IncentiveEventType,
  occurredAt: Date,
  context: IncentiveContext,
): IncentiveRuleRow | null {
  const applicable = rules
    .filter((rule) => rule.eventType === eventType)
    .filter((rule) => isRuleInEffect(rule, occurredAt))
    .filter((rule) => conditionsSatisfied(rule.conditions, context, occurredAt))
    .sort((a, b) => a.priority - b.priority || b.amountYen - a.amountYen);

  return applicable[0] ?? null;
}

export function isIncentivisedEvent(eventType: string): eventType is IncentiveEventType {
  return (INCENTIVE_EVENT_TYPES as readonly string[]).includes(eventType);
}
