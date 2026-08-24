export type MonetizableEvent =
  | 'diagnosis_completed'
  | 'lead_registered'
  | 'interview_booked'
  | 'interview_completed'
  | 'candidate_qualified'
  | 'agent_referred'
  | 'agent_accepted'
  | 'agent_interview_completed'
  | 'offer'
  | 'joined';

export type IncentiveStatus = 'pending' | 'approved' | 'rejected' | 'paid';

export interface IncentiveRule {
  id: string;
  eventType: MonetizableEvent;
  amount: number;
  validFrom: Date;
  validTo: Date | null;
  active: boolean;
  conditions: IncentiveConditions;
}

/** Conditions understood by the engine. Anything else is ignored (and reported). */
export interface IncentiveConditions {
  minMatchScore?: number;
  minMarketValueScore?: number;
  venueTypes?: string[];
  requiresQualified?: boolean;
}

export interface IncentiveContext {
  candidateId: string;
  salesUserId: string | null;
  shiftId: string | null;
  eventType: MonetizableEvent;
  occurredAt: Date;
  matchScore?: number | null;
  marketValueScore?: number | null;
  venueType?: string | null;
  qualified?: boolean;
}

export interface LedgerKey {
  candidateId: string;
  eventType: MonetizableEvent;
}

export type IncentiveDecision =
  | {
      awarded: true;
      amount: number;
      ruleId: string;
      salesUserId: string;
      candidateId: string;
      shiftId: string | null;
      eventType: MonetizableEvent;
      occurredAt: Date;
    }
  | { awarded: false; reason: IncentiveSkipReason };

export type IncentiveSkipReason =
  | 'no_attribution'
  | 'duplicate'
  | 'no_active_rule'
  | 'conditions_not_met';
