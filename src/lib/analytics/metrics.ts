import { safeDivide } from "@/lib/utils/format";
import type {
  ConversionRates,
  FinancialTotals,
  FunnelCounts,
  UnitEconomics,
} from "./types";

export function computeRates(funnel: FunnelCounts): ConversionRates {
  return {
    stopRate: safeDivide(funnel.stops, funnel.approaches),
    qrRate: safeDivide(funnel.scans, funnel.stops),
    diagnosisStartRate: safeDivide(funnel.diagnosisStarted, funnel.scans),
    diagnosisCompletionRate: safeDivide(funnel.diagnosisCompleted, funnel.diagnosisStarted),
    registrationRate: safeDivide(funnel.leads, funnel.diagnosisCompleted),
    interviewBookingRate: safeDivide(funnel.interviewBooked, funnel.leads),
    interviewAttendanceRate: safeDivide(funnel.interviewCompleted, funnel.interviewBooked),
    qualifiedRate: safeDivide(funnel.qualified, funnel.interviewCompleted),
    referralRate: safeDivide(funnel.referrals, funnel.qualified),
    offerRate: safeDivide(funnel.offers, funnel.referrals),
    joinRate: safeDivide(funnel.joins, funnel.offers),
  };
}

export function computeContributionMargin(financials: FinancialTotals): number {
  return (
    financials.confirmedRevenueYen -
    financials.incentiveYen -
    financials.otherAcquisitionCostYen
  );
}

/**
 * Cost figures use the acquisition cost actually incurred (incentives + direct
 * spend). Revenue-side figures use confirmed revenue, so a run of optimistic
 * pipeline never inflates gross profit per sales hour.
 */
export function computeUnitEconomics(
  funnel: FunnelCounts,
  financials: FinancialTotals,
): UnitEconomics {
  const cost = financials.incentiveYen + financials.otherAcquisitionCostYen;
  const grossProfit = financials.confirmedRevenueYen - cost;

  return {
    costPerScan: safeDivide(cost, funnel.scans),
    costPerDiagnosis: safeDivide(cost, funnel.diagnosisCompleted),
    costPerLead: safeDivide(cost, funnel.leads),
    costPerInterview: safeDivide(cost, funnel.interviewCompleted),
    costPerQualified: safeDivide(cost, funnel.qualified),
    revenuePerLead: safeDivide(financials.confirmedRevenueYen, funnel.leads),
    revenuePerReferral: safeDivide(financials.confirmedRevenueYen, funnel.referrals),
    revenuePerSalesHour: safeDivide(financials.confirmedRevenueYen, funnel.salesHours),
    incentivePerSalesHour: safeDivide(financials.incentiveYen, funnel.salesHours),
    grossProfitPerSalesHour: safeDivide(grossProfit, funnel.salesHours),
  };
}
