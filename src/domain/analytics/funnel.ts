import type { AnalyticsConfig } from '@/domain/config/analytics-config';

export const FUNNEL_EVENTS = [
  'qr_scanned',
  'diagnosis_started',
  'diagnosis_completed',
  'lead_registered',
  'interview_booked',
  'interview_completed',
  'candidate_qualified',
  'agent_referred',
  'offer_received',
  'joined',
] as const;

export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];

export interface CandidateEventRow {
  candidateId: string;
  eventType: string;
}

export type FunnelCounts = Record<FunnelEvent, number>;

/**
 * Counts distinct candidates per funnel event. Deriving the funnel from the
 * event log (not from status columns) means the funnel can be redefined later
 * without a data migration.
 */
export function countFunnel(events: CandidateEventRow[]): FunnelCounts {
  const seen = new Map<FunnelEvent, Set<string>>();
  for (const event of FUNNEL_EVENTS) seen.set(event, new Set());
  for (const row of events) {
    const bucket = seen.get(row.eventType as FunnelEvent);
    if (bucket) bucket.add(row.candidateId);
  }
  const counts = {} as FunnelCounts;
  for (const event of FUNNEL_EVENTS) {
    counts[event] = seen.get(event)?.size ?? 0;
  }
  return counts;
}

export interface AcquisitionCounts extends FunnelCounts {
  approaches: number;
  stops: number;
  salesHours: number;
}

export interface FunnelRates {
  stopRate: number;
  scanRate: number;
  diagnosisStartRate: number;
  diagnosisCompletionRate: number;
  registrationRate: number;
  interviewBookingRate: number;
  interviewAttendanceRate: number;
  qualifiedRate: number;
  referralRate: number;
  offerRate: number;
  joinRate: number;
}

export function safeRate(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

export function computeRates(counts: AcquisitionCounts): FunnelRates {
  return {
    stopRate: safeRate(counts.stops, counts.approaches),
    scanRate: safeRate(counts.qr_scanned, counts.stops),
    diagnosisStartRate: safeRate(counts.diagnosis_started, counts.qr_scanned),
    diagnosisCompletionRate: safeRate(counts.diagnosis_completed, counts.diagnosis_started),
    registrationRate: safeRate(counts.lead_registered, counts.diagnosis_completed),
    interviewBookingRate: safeRate(counts.interview_booked, counts.lead_registered),
    interviewAttendanceRate: safeRate(counts.interview_completed, counts.interview_booked),
    qualifiedRate: safeRate(counts.candidate_qualified, counts.diagnosis_completed),
    referralRate: safeRate(counts.agent_referred, counts.candidate_qualified),
    offerRate: safeRate(counts.offer_received, counts.agent_referred),
    joinRate: safeRate(counts.joined, counts.offer_received),
  };
}

export interface FinancialInput {
  salesHours: number;
  estimatedRevenue: number;
  confirmedRevenue: number;
  incentiveAmount: number;
  counts: AcquisitionCounts;
}

export interface UnitEconomics {
  estimatedRevenue: number;
  confirmedRevenue: number;
  salesIncentives: number;
  baseWageCost: number;
  otherAcquisitionCost: number;
  totalCost: number;
  contributionMargin: number;
  revenuePerSalesHour: number;
  grossProfitPerSalesHour: number;
  incentivePerSalesHour: number;
  costPerScan: number;
  costPerDiagnosis: number;
  costPerLead: number;
  costPerInterview: number;
  costPerQualified: number;
  revenuePerLead: number;
  revenuePerReferral: number;
}

/**
 * Revenue recognised for margin purposes is confirmed revenue plus estimated
 * revenue that has not been confirmed yet; both are reported separately so the
 * operator can decide which one to trust.
 */
export function computeUnitEconomics(input: FinancialInput, config: AnalyticsConfig): UnitEconomics {
  const { salesHours, counts } = input;
  const baseWageCost = Math.round(salesHours * config.salesBaseHourlyWageJpy);
  const otherAcquisitionCost = Math.round(salesHours * config.otherCostPerSalesHourJpy);
  const totalCost = input.incentiveAmount + baseWageCost + otherAcquisitionCost;
  const revenue = input.estimatedRevenue;
  const contributionMargin = revenue - totalCost;

  return {
    estimatedRevenue: input.estimatedRevenue,
    confirmedRevenue: input.confirmedRevenue,
    salesIncentives: input.incentiveAmount,
    baseWageCost,
    otherAcquisitionCost,
    totalCost,
    contributionMargin,
    revenuePerSalesHour: safeRate(revenue, salesHours),
    grossProfitPerSalesHour: safeRate(contributionMargin, salesHours),
    incentivePerSalesHour: safeRate(input.incentiveAmount, salesHours),
    costPerScan: safeRate(totalCost, counts.qr_scanned),
    costPerDiagnosis: safeRate(totalCost, counts.diagnosis_completed),
    costPerLead: safeRate(totalCost, counts.lead_registered),
    costPerInterview: safeRate(totalCost, counts.interview_completed),
    costPerQualified: safeRate(totalCost, counts.candidate_qualified),
    revenuePerLead: safeRate(revenue, counts.lead_registered),
    revenuePerReferral: safeRate(revenue, counts.agent_referred),
  };
}
