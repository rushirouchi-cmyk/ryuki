import { getDb } from "@/lib/db";
import { getBreakdown, getFilterOptions, getOverview } from "@/lib/analytics/queries";
import { buildFilter } from "@/lib/analytics/filter-params";
import { computeRates } from "@/lib/analytics/metrics";
import { buildFunnelSteps } from "@/lib/analytics/funnel-steps";
import { Card, CardTitle, NumTd, PageHeader, TableWrap, Td, Th } from "@/components/ui";
import { PeriodTabs } from "@/components/analytics/period-tabs";
import { FilterBar } from "@/components/analytics/filter-bar";
import { FunnelChart, FunnelScaleNote } from "@/components/analytics/funnel-chart";
import { formatNumber, formatPercent } from "@/lib/utils/format";

export default async function FunnelPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { period, filter } = buildFilter(params);
  const db = await getDb();

  const [options, { funnel }, byLocation] = await Promise.all([
    getFilterOptions(db),
    getOverview(db, filter),
    getBreakdown(db, filter, "location"),
  ]);

  const rates = computeRates(funnel);
  const steps = buildFunnelSteps(funnel, rates);

  return (
    <>
      <PageHeader
        title="ファネル"
        description={`${period.label}｜candidate_events から集計しています`}
        actions={<PeriodTabs active={period.key} />}
      />

      <Card className="mb-6">
        <CardTitle>絞り込み</CardTitle>
        <div className="mt-3">
          <FilterBar options={options} />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>全体ファネル</CardTitle>
          <div className="mt-4">
            <FunnelChart steps={steps} />
            <FunnelScaleNote />
          </div>
        </Card>

        <Card>
          <CardTitle>ステップ別の内訳</CardTitle>
          <div className="mt-3">
            <TableWrap>
              <thead>
                <tr>
                  <Th>ステップ</Th>
                  <Th className="text-right">件数</Th>
                  <Th className="text-right">直前からの転換率</Th>
                  <Th className="text-right">声掛けからの通過率</Th>
                </tr>
              </thead>
              <tbody>
                {steps.map((step, index) => (
                  <tr key={step.label}>
                    <Td className="font-medium">{step.label}</Td>
                    <NumTd>{formatNumber(step.value)}</NumTd>
                    <NumTd>{index === 0 ? "—" : formatPercent(step.rate)}</NumTd>
                    <NumTd>
                      {funnel.approaches === 0
                        ? "—"
                        : formatPercent(step.value / funnel.approaches, 2)}
                    </NumTd>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </div>
        </Card>
      </div>

      <section className="mt-8">
        <CardTitle>営業場所別のファネル比較</CardTitle>
        <div className="mt-2">
          <TableWrap>
            <thead>
              <tr>
                <Th>営業場所</Th>
                <Th className="text-right">声掛け</Th>
                <Th className="text-right">立ち止まり率</Th>
                <Th className="text-right">QR率</Th>
                <Th className="text-right">診断完了率</Th>
                <Th className="text-right">登録率</Th>
                <Th className="text-right">面談予約率</Th>
                <Th className="text-right">着座率</Th>
                <Th className="text-right">有効化率</Th>
                <Th className="text-right">送客率</Th>
              </tr>
            </thead>
            <tbody>
              {byLocation.map((row) => (
                <tr key={row.key}>
                  <Td className="font-medium">{row.label}</Td>
                  <NumTd>{formatNumber(row.funnel.approaches)}</NumTd>
                  <NumTd>{formatPercent(row.rates.stopRate)}</NumTd>
                  <NumTd>{formatPercent(row.rates.qrRate)}</NumTd>
                  <NumTd>{formatPercent(row.rates.diagnosisCompletionRate)}</NumTd>
                  <NumTd>{formatPercent(row.rates.registrationRate)}</NumTd>
                  <NumTd>{formatPercent(row.rates.interviewBookingRate)}</NumTd>
                  <NumTd>{formatPercent(row.rates.interviewAttendanceRate)}</NumTd>
                  <NumTd>{formatPercent(row.rates.qualifiedRate)}</NumTd>
                  <NumTd>{formatPercent(row.rates.referralRate)}</NumTd>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </div>
      </section>
    </>
  );
}
