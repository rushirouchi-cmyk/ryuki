export const APP_TIMEZONE = "Asia/Tokyo";

/** Four-hour bands; regenerated from this table alone, never hardcoded in SQL. */
export const TIME_BANDS = [
  { key: "07-11", label: "07:00〜11:00", startHour: 7, endHour: 11 },
  { key: "11-15", label: "11:00〜15:00", startHour: 11, endHour: 15 },
  { key: "15-19", label: "15:00〜19:00", startHour: 15, endHour: 19 },
  { key: "19-23", label: "19:00〜23:00", startHour: 19, endHour: 23 },
  { key: "other", label: "その他", startHour: 23, endHour: 7 },
] as const;

export function timeBandFor(hour: number): string {
  for (const band of TIME_BANDS) {
    if (band.key === "other") continue;
    if (hour >= band.startHour && hour < band.endHour) return band.key;
  }
  return "other";
}

export type BreakdownDimension =
  | "location"
  | "venue_type"
  | "prefecture"
  | "city"
  | "sales_user"
  | "weekday"
  | "time_band"
  | "weather"
  | "area_time_band";

export interface AnalyticsFilter {
  from: Date;
  to: Date;
  locationIds?: number[];
  prefectures?: string[];
  cities?: string[];
  venueTypes?: string[];
  salesUserIds?: string[];
  weekdays?: number[];
  timeBands?: string[];
  weather?: string[];
}

export interface FunnelCounts {
  salesHours: number;
  approaches: number;
  stops: number;
  scans: number;
  diagnosisStarted: number;
  diagnosisCompleted: number;
  leads: number;
  interviewBooked: number;
  interviewCompleted: number;
  qualified: number;
  referrals: number;
  offers: number;
  joins: number;
}

export interface ConversionRates {
  stopRate: number | null;
  qrRate: number | null;
  diagnosisStartRate: number | null;
  diagnosisCompletionRate: number | null;
  registrationRate: number | null;
  interviewBookingRate: number | null;
  interviewAttendanceRate: number | null;
  qualifiedRate: number | null;
  referralRate: number | null;
  offerRate: number | null;
  joinRate: number | null;
}

export interface FinancialTotals {
  estimatedRevenueYen: number;
  confirmedRevenueYen: number;
  incentiveYen: number;
  otherAcquisitionCostYen: number;
  contributionMarginYen: number;
}

export interface UnitEconomics {
  costPerScan: number | null;
  costPerDiagnosis: number | null;
  costPerLead: number | null;
  costPerInterview: number | null;
  costPerQualified: number | null;
  revenuePerLead: number | null;
  revenuePerReferral: number | null;
  revenuePerSalesHour: number | null;
  incentivePerSalesHour: number | null;
  grossProfitPerSalesHour: number | null;
}

export interface BreakdownRow {
  key: string;
  label: string;
  sublabel?: string;
  funnel: FunnelCounts;
  rates: ConversionRates;
  financials: FinancialTotals;
  economics: UnitEconomics;
}

export const EMPTY_FUNNEL: FunnelCounts = {
  salesHours: 0,
  approaches: 0,
  stops: 0,
  scans: 0,
  diagnosisStarted: 0,
  diagnosisCompleted: 0,
  leads: 0,
  interviewBooked: 0,
  interviewCompleted: 0,
  qualified: 0,
  referrals: 0,
  offers: 0,
  joins: 0,
};

export const EMPTY_FINANCIALS: FinancialTotals = {
  estimatedRevenueYen: 0,
  confirmedRevenueYen: 0,
  incentiveYen: 0,
  otherAcquisitionCostYen: 0,
  contributionMarginYen: 0,
};
