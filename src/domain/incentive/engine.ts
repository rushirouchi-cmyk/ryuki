import type {
  IncentiveConditions,
  IncentiveContext,
  IncentiveDecision,
  IncentiveRule,
  LedgerKey,
} from './types';

/** Rules with no reward configured are never awarded (e.g. raw QR scans). */
export function findApplicableRules(rules: IncentiveRule[], context: IncentiveContext): IncentiveRule[] {
  return rules.filter((rule) => {
    if (!rule.active) return false;
    if (rule.eventType !== context.eventType) return false;
    if (rule.validFrom.getTime() > context.occurredAt.getTime()) return false;
    if (rule.validTo && rule.validTo.getTime() <= context.occurredAt.getTime()) return false;
    return true;
  });
}

export function conditionsMet(conditions: IncentiveConditions, context: IncentiveContext): boolean {
  if (conditions.minMatchScore !== undefined) {
    if (context.matchScore == null || context.matchScore < conditions.minMatchScore) return false;
  }
  if (conditions.minMarketValueScore !== undefined) {
    if (context.marketValueScore == null || context.marketValueScore < conditions.minMarketValueScore) {
      return false;
    }
  }
  if (conditions.venueTypes && conditions.venueTypes.length > 0) {
    if (!context.venueType || !conditions.venueTypes.includes(context.venueType)) return false;
  }
  if (conditions.requiresQualified && !context.qualified) return false;
  return true;
}

/**
 * Decides whether a sales incentive is owed for one candidate event.
 *
 * Guarantees:
 * - no attribution -> no payout (street reps only earn on candidates they sourced)
 * - one payout per (candidate, event type) — matches the DB unique index
 * - only rules valid at `occurredAt` are considered; ties break on the most
 *   recently effective rule, then the larger amount
 */
export function evaluateIncentive(
  context: IncentiveContext,
  rules: IncentiveRule[],
  existingLedger: LedgerKey[],
): IncentiveDecision {
  if (!context.salesUserId) {
    return { awarded: false, reason: 'no_attribution' };
  }
  const duplicate = existingLedger.some(
    (entry) => entry.candidateId === context.candidateId && entry.eventType === context.eventType,
  );
  if (duplicate) {
    return { awarded: false, reason: 'duplicate' };
  }

  const applicable = findApplicableRules(rules, context);
  if (applicable.length === 0) {
    return { awarded: false, reason: 'no_active_rule' };
  }

  const passing = applicable.filter((rule) => conditionsMet(rule.conditions, context));
  if (passing.length === 0) {
    return { awarded: false, reason: 'conditions_not_met' };
  }

  const chosen = [...passing].sort((a, b) => {
    const byDate = b.validFrom.getTime() - a.validFrom.getTime();
    return byDate !== 0 ? byDate : b.amount - a.amount;
  })[0];

  if (!chosen) {
    return { awarded: false, reason: 'no_active_rule' };
  }

  return {
    awarded: true,
    amount: chosen.amount,
    ruleId: chosen.id,
    salesUserId: context.salesUserId,
    candidateId: context.candidateId,
    shiftId: context.shiftId,
    eventType: context.eventType,
    occurredAt: context.occurredAt,
  };
}

export function sumApprovedAmount(
  entries: { amount: number; status: string }[],
  statuses: string[] = ['approved', 'paid'],
): number {
  return entries.filter((e) => statuses.includes(e.status)).reduce((sum, e) => sum + e.amount, 0);
}

/** Pending + approved + paid: what the rep believes they have earned so far. */
export function sumEarnedAmount(entries: { amount: number; status: string }[]): number {
  return entries.filter((e) => e.status !== 'rejected').reduce((sum, e) => sum + e.amount, 0);
}
