import { formatPercent } from "@/lib/utils/format";
import type { FunnelStep } from "@/components/analytics/funnel-chart";
import type { ConversionRates, FunnelCounts } from "./types";

/** Single definition of the funnel, shared by every admin view. */
export function buildFunnelSteps(
  funnel: FunnelCounts,
  rates: ConversionRates,
): FunnelStep[] {
  return [
    { label: "声掛け", value: funnel.approaches, rate: null, rateLabel: "" },
    { label: "立ち止まり", value: funnel.stops, rate: rates.stopRate, rateLabel: "Stop" },
    { label: "QR読取", value: funnel.scans, rate: rates.qrRate, rateLabel: "QR" },
    {
      label: "診断開始",
      value: funnel.diagnosisStarted,
      rate: rates.diagnosisStartRate,
      rateLabel: "開始",
    },
    {
      label: "診断完了",
      value: funnel.diagnosisCompleted,
      rate: rates.diagnosisCompletionRate,
      rateLabel: "完了",
    },
    {
      label: "リード登録",
      value: funnel.leads,
      rate: rates.registrationRate,
      rateLabel: "登録",
    },
    {
      label: "面談予約",
      value: funnel.interviewBooked,
      rate: rates.interviewBookingRate,
      rateLabel: "予約",
    },
    {
      label: "面談実施",
      value: funnel.interviewCompleted,
      rate: rates.interviewAttendanceRate,
      rateLabel: "着座",
    },
    {
      label: "有効候補者",
      value: funnel.qualified,
      rate: rates.qualifiedRate,
      rateLabel: "有効",
    },
    {
      label: "エージェント送客",
      value: funnel.referrals,
      rate: rates.referralRate,
      rateLabel: "送客",
    },
    { label: "内定", value: funnel.offers, rate: rates.offerRate, rateLabel: "内定" },
    { label: "入社", value: funnel.joins, rate: rates.joinRate, rateLabel: "入社" },
  ];
}

export function describeRate(value: number | null): string {
  return formatPercent(value);
}
