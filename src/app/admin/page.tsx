import { getDb } from "@/lib/db";
import { getDailySeries, getOverview } from "@/lib/analytics/queries";
import { computeRates, computeUnitEconomics } from "@/lib/analytics/metrics";
import { buildFunnelSteps } from "@/lib/analytics/funnel-steps";
import { resolvePeriod } from "@/lib/analytics/period";
import { Card, CardTitle, PageHeader, StatTile } from "@/components/ui";
import { PeriodTabs } from "@/components/analytics/period-tabs";
import { FunnelChart } from "@/components/analytics/funnel-chart";
import { TrendChart } from "@/components/analytics/trend-chart";
import { formatNumber, formatPercent, formatYen } from "@/lib/utils/format";

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const period = resolvePeriod(params);
  const db = await getDb();

  const filter = { from: period.from, to: period.to };
  const [{ funnel, financials }, series] = await Promise.all([
    getOverview(db, filter),
    getDailySeries(db, filter),
  ]);

  const rates = computeRates(funnel);
  const economics = computeUnitEconomics(funnel, financials);
  const grossProfit =
    financials.confirmedRevenueYen -
    financials.incentiveYen -
    financials.otherAcquisitionCostYen;

  return (
    <>
      <PageHeader
        title="サマリー"
        description={`${period.label}（${period.from.toLocaleDateString(
          "ja-JP",
        )} 〜 ${period.to.toLocaleDateString("ja-JP")}）`}
        actions={<PeriodTabs active={period.key} />}
      />

      <section>
        <CardTitle>獲得</CardTitle>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile label="営業時間" value={`${funnel.salesHours.toFixed(1)}h`} />
          <StatTile label="声掛け" value={formatNumber(funnel.approaches)} />
          <StatTile label="立ち止まり" value={formatNumber(funnel.stops)} />
          <StatTile label="QR読取" value={formatNumber(funnel.scans)} />
          <StatTile label="診断完了" value={formatNumber(funnel.diagnosisCompleted)} />
          <StatTile label="リード" value={formatNumber(funnel.leads)} tone="brand" />
          <StatTile label="面談予約" value={formatNumber(funnel.interviewBooked)} />
          <StatTile label="面談実施" value={formatNumber(funnel.interviewCompleted)} />
          <StatTile label="有効候補者" value={formatNumber(funnel.qualified)} tone="brand" />
          <StatTile label="送客" value={formatNumber(funnel.referrals)} />
          <StatTile label="内定" value={formatNumber(funnel.offers)} />
          <StatTile label="入社" value={formatNumber(funnel.joins)} tone="positive" />
        </div>
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>ファネル</CardTitle>
          <div className="mt-4">
            <FunnelChart steps={buildFunnelSteps(funnel, rates)} />
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardTitle>推移</CardTitle>
            <div className="mt-2">
              <TrendChart data={series} />
            </div>
          </Card>
          <Card>
            <CardTitle>主要転換率</CardTitle>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {[
                ["立ち止まり率", rates.stopRate],
                ["QR読取率", rates.qrRate],
                ["診断完了率", rates.diagnosisCompletionRate],
                ["リード登録率", rates.registrationRate],
                ["面談予約率", rates.interviewBookingRate],
                ["面談着座率", rates.interviewAttendanceRate],
                ["有効化率", rates.qualifiedRate],
                ["送客率", rates.referralRate],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex justify-between gap-2">
                  <dt className="text-ink-500">{label}</dt>
                  <dd className="tabular font-semibold">
                    {formatPercent(value as number | null)}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </section>

      <section className="mt-8">
        <CardTitle>収支</CardTitle>
        <div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="確定売上"
            value={formatYen(financials.confirmedRevenueYen)}
            tone="positive"
          />
          <StatTile
            label="見込み売上"
            value={formatYen(financials.estimatedRevenueYen)}
            hint="未確定のフィーを含む"
          />
          <StatTile label="営業インセンティブ" value={formatYen(financials.incentiveYen)} />
          <StatTile
            label="その他獲得コスト"
            value={formatYen(financials.otherAcquisitionCostYen)}
          />
          <StatTile
            label="貢献利益"
            value={formatYen(grossProfit)}
            tone={grossProfit >= 0 ? "positive" : "negative"}
          />
          <StatTile
            label="売上 / 営業時間"
            value={formatYen(economics.revenuePerSalesHour)}
          />
          <StatTile
            label="粗利 / 営業時間"
            value={formatYen(economics.grossProfitPerSalesHour)}
            tone={(economics.grossProfitPerSalesHour ?? 0) >= 0 ? "positive" : "negative"}
            hint="最重要指標"
          />
          <StatTile label="コスト / リード" value={formatYen(economics.costPerLead)} />
          <StatTile
            label="コスト / 有効候補者"
            value={formatYen(economics.costPerQualified)}
          />
          <StatTile label="コスト / QR読取" value={formatYen(economics.costPerScan)} />
          <StatTile label="売上 / リード" value={formatYen(economics.revenuePerLead)} />
          <StatTile label="売上 / 送客" value={formatYen(economics.revenuePerReferral)} />
        </div>
      </section>
    </>
  );
}
