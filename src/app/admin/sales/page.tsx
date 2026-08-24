import { getDb } from "@/lib/db";
import { getBreakdown, getFilterOptions } from "@/lib/analytics/queries";
import { buildFilter } from "@/lib/analytics/filter-params";
import {
  Card,
  CardTitle,
  EmptyState,
  NumTd,
  PageHeader,
  TableWrap,
  Td,
  Th,
} from "@/components/ui";
import { PeriodTabs } from "@/components/analytics/period-tabs";
import { FilterBar } from "@/components/analytics/filter-bar";
import { formatNumber, formatPercent, formatYen, safeDivide } from "@/lib/utils/format";

export default async function AdminSalesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { period, filter } = buildFilter(params);
  const db = await getDb();

  const [options, rows] = await Promise.all([
    getFilterOptions(db),
    getBreakdown(db, filter, "sales_user"),
  ]);

  return (
    <>
      <PageHeader
        title="営業担当分析"
        description={`${period.label}｜獲得件数ではなく、営業時間あたりの粗利で評価します`}
        actions={<PeriodTabs active={period.key} />}
      />

      <Card className="mb-6">
        <CardTitle>絞り込み</CardTitle>
        <div className="mt-3">
          <FilterBar options={options} />
        </div>
      </Card>

      {rows.length === 0 ? (
        <EmptyState title="対象期間の営業実績がありません" />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>営業担当</Th>
              <Th className="text-right">営業時間</Th>
              <Th className="text-right">声掛け/h</Th>
              <Th className="text-right">立ち止まり率</Th>
              <Th className="text-right">QR率</Th>
              <Th className="text-right">診断完了率</Th>
              <Th className="text-right">リード率</Th>
              <Th className="text-right">有効化率</Th>
              <Th className="text-right">送客率</Th>
              <Th className="text-right">確定売上</Th>
              <Th className="text-right">インセンティブ</Th>
              <Th className="text-right">粗利</Th>
              <Th className="text-right">粗利/h</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const grossProfit =
                row.financials.confirmedRevenueYen -
                row.financials.incentiveYen -
                row.financials.otherAcquisitionCostYen;
              return (
                <tr key={row.key}>
                  <Td className="font-medium text-ink-900">{row.label}</Td>
                  <NumTd>{row.funnel.salesHours.toFixed(1)}h</NumTd>
                  <NumTd>
                    {formatNumber(
                      safeDivide(row.funnel.approaches, row.funnel.salesHours) ?? 0,
                      1,
                    )}
                  </NumTd>
                  <NumTd>{formatPercent(row.rates.stopRate)}</NumTd>
                  <NumTd>{formatPercent(row.rates.qrRate)}</NumTd>
                  <NumTd>{formatPercent(row.rates.diagnosisCompletionRate)}</NumTd>
                  <NumTd>{formatPercent(row.rates.registrationRate)}</NumTd>
                  <NumTd>{formatPercent(row.rates.qualifiedRate)}</NumTd>
                  <NumTd>{formatPercent(row.rates.referralRate)}</NumTd>
                  <NumTd>{formatYen(row.financials.confirmedRevenueYen)}</NumTd>
                  <NumTd>{formatYen(row.financials.incentiveYen)}</NumTd>
                  <NumTd
                    className={
                      grossProfit >= 0
                        ? "font-semibold text-positive"
                        : "font-semibold text-negative"
                    }
                  >
                    {formatYen(grossProfit)}
                  </NumTd>
                  <NumTd className="font-semibold">
                    {formatYen(row.economics.grossProfitPerSalesHour)}
                  </NumTd>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      )}

      <p className="mt-3 text-xs text-ink-500">
        売上・粗利は、その営業担当が獲得した候補者から発生したフィーを acquisition
        単位で紐づけています。将来的には同じ構造で 30 / 60 / 90 日 LTV
        を評価できます。
      </p>
    </>
  );
}
