import { describe, expect, it } from 'vitest';
import { conditionsMet, evaluateIncentive, findApplicableRules, sumApprovedAmount, sumEarnedAmount } from './engine';
import type { IncentiveContext, IncentiveRule } from './types';

const CANDIDATE = 'candidate-1';
const SALES = 'sales-1';
const SHIFT = 'shift-1';

function rule(overrides: Partial<IncentiveRule> = {}): IncentiveRule {
  return {
    id: 'rule-lead',
    eventType: 'lead_registered',
    amount: 500,
    validFrom: new Date('2026-01-01T00:00:00Z'),
    validTo: null,
    active: true,
    conditions: {},
    ...overrides,
  };
}

function context(overrides: Partial<IncentiveContext> = {}): IncentiveContext {
  return {
    candidateId: CANDIDATE,
    salesUserId: SALES,
    shiftId: SHIFT,
    eventType: 'lead_registered',
    occurredAt: new Date('2026-06-01T10:00:00Z'),
    ...overrides,
  };
}

describe('findApplicableRules', () => {
  it('ignores rules for a different event', () => {
    expect(findApplicableRules([rule({ eventType: 'joined' })], context())).toHaveLength(0);
  });

  it('ignores inactive rules', () => {
    expect(findApplicableRules([rule({ active: false })], context())).toHaveLength(0);
  });

  it('ignores rules that have not started yet', () => {
    const future = rule({ validFrom: new Date('2026-12-01T00:00:00Z') });
    expect(findApplicableRules([future], context())).toHaveLength(0);
  });

  it('ignores rules that have already expired', () => {
    const expired = rule({ validTo: new Date('2026-05-01T00:00:00Z') });
    expect(findApplicableRules([expired], context())).toHaveLength(0);
  });

  it('keeps a rule that is live at the event time', () => {
    const live = rule({ validTo: new Date('2026-07-01T00:00:00Z') });
    expect(findApplicableRules([live], context())).toHaveLength(1);
  });
});

describe('conditionsMet', () => {
  it('requires the configured market value score', () => {
    expect(conditionsMet({ minMarketValueScore: 55 }, context({ marketValueScore: 60 }))).toBe(true);
    expect(conditionsMet({ minMarketValueScore: 55 }, context({ marketValueScore: 40 }))).toBe(false);
    expect(conditionsMet({ minMarketValueScore: 55 }, context({ marketValueScore: null }))).toBe(false);
  });

  it('restricts payouts to the configured venue types', () => {
    expect(conditionsMet({ venueTypes: ['shopping_mall'] }, context({ venueType: 'shopping_mall' }))).toBe(true);
    expect(conditionsMet({ venueTypes: ['shopping_mall'] }, context({ venueType: 'station' }))).toBe(false);
  });

  it('can require the candidate to be qualified', () => {
    expect(conditionsMet({ requiresQualified: true }, context({ qualified: true }))).toBe(true);
    expect(conditionsMet({ requiresQualified: true }, context({ qualified: false }))).toBe(false);
  });
});

describe('evaluateIncentive', () => {
  it('awards the configured amount for a valid event', () => {
    const decision = evaluateIncentive(context(), [rule()], []);
    expect(decision).toMatchObject({ awarded: true, amount: 500, ruleId: 'rule-lead', salesUserId: SALES });
  });

  it('never pays when the candidate has no attribution', () => {
    const decision = evaluateIncentive(context({ salesUserId: null }), [rule()], []);
    expect(decision).toEqual({ awarded: false, reason: 'no_attribution' });
  });

  it('prevents double counting the same candidate and event', () => {
    const decision = evaluateIncentive(context(), [rule()], [
      { candidateId: CANDIDATE, eventType: 'lead_registered' },
    ]);
    expect(decision).toEqual({ awarded: false, reason: 'duplicate' });
  });

  it('still pays a different event for the same candidate', () => {
    const decision = evaluateIncentive(
      context({ eventType: 'interview_booked' }),
      [rule({ id: 'rule-interview', eventType: 'interview_booked', amount: 1000 })],
      [{ candidateId: CANDIDATE, eventType: 'lead_registered' }],
    );
    expect(decision).toMatchObject({ awarded: true, amount: 1000 });
  });

  it('reports when no rule is configured (e.g. QR scans earn nothing)', () => {
    const decision = evaluateIncentive(context({ eventType: 'diagnosis_completed' }), [rule()], []);
    expect(decision).toEqual({ awarded: false, reason: 'no_active_rule' });
  });

  it('reports when a rule exists but its conditions are not met', () => {
    const decision = evaluateIncentive(
      context({ marketValueScore: 10 }),
      [rule({ conditions: { minMarketValueScore: 55 } })],
      [],
    );
    expect(decision).toEqual({ awarded: false, reason: 'conditions_not_met' });
  });

  it('picks the most recently effective rule when several apply', () => {
    const older = rule({ id: 'old', amount: 300, validFrom: new Date('2026-01-01T00:00:00Z') });
    const newer = rule({ id: 'new', amount: 800, validFrom: new Date('2026-05-01T00:00:00Z') });
    const decision = evaluateIncentive(context(), [older, newer], []);
    expect(decision).toMatchObject({ awarded: true, ruleId: 'new', amount: 800 });
  });
});

describe('ledger sums', () => {
  const entries = [
    { amount: 500, status: 'pending' },
    { amount: 1000, status: 'approved' },
    { amount: 2000, status: 'paid' },
    { amount: 9999, status: 'rejected' },
  ];

  it('counts only approved and paid rows as confirmed', () => {
    expect(sumApprovedAmount(entries)).toBe(3000);
  });

  it('counts everything except rejected rows as earned', () => {
    expect(sumEarnedAmount(entries)).toBe(3500);
  });
});
