import { Card, Table, Td, Th } from '@/components/ui';
import { PeriodFilter } from '@/components/period-filter';
import { SegmentTable } from '@/components/segment-table';
import { ComparisonChart } from '@/components/comparison-chart';
import { requireAdmin } from '@/server/guards';
import { loadCohortDataset, segmentBySalesUser } from '@/server/services/analytics';
import { resolvePeriod } from '@/lib/period';
import { formatNumber, formatPercent, formatYen } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function AdminSalesPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  await requireAdmin();
  const query = await searchParams;
  const period = resolvePeriod(query);
  const dataset = await loadCohortDataset({ from: period.from, to: period.to });
  const segments = segmentBySalesUser(dataset);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ink-900">営業担当分析</h1>
          <p className="text-xs text-ink-500">
            獲得件数だけでなく、粗利/h と後工程の転換率まで含めて評価します
          </p>
        </div>
        <PeriodFilter period={period} basePath="/admin/sales" query={query} />
      </div>

      <Card title="営業担当別サマリー">
        <SegmentTable segments={segments} firstColumnLabel="営業担当" showAreaScore={false} />
      </Card>

      <Card title="効率指標" description="1営業時間あたりの成果">
        <Table>
          <thead>
            <tr>
              <Th>営業担当</Th>
              <Th align="right">稼働h</Th>
              <Th align="right">声掛け/h</Th>
              <Th align="right">立止り率</Th>
              <Th align="right">QR率</Th>
              <Th align="right">診断完了率</Th>
              <Th align="right">リード率</Th>
              <Th align="right">有望率</Th>
              <Th align="right">送客率</Th>
              <Th align="right">売上</Th>
              <Th align="right">インセンティブ</Th>
              <Th align="right">粗利</Th>
              <Th align="right">粗利/h</Th>
            </tr>
          </thead>
          <tbody>
            {segments.map((segment) => (
              <tr key={segment.key}>
                <Td>{segment.label}</Td>
                <Td align="right">{formatNumber(segment.counts.salesHours, 1)}</Td>
                <Td align="right">
                  {formatNumber(
                    segment.counts.salesHours ? segment.counts.approaches / segment.counts.salesHours : 0,
                    1,
                  )}
                </Td>
                <Td align="right">{formatPercent(segment.rates.stopRate)}</Td>
                <Td align="right">{formatPercent(segment.rates.scanRate)}</Td>
                <Td align="right">{formatPercent(segment.rates.diagnosisCompletionRate)}</Td>
                <Td align="right">{formatPercent(segment.rates.registrationRate)}</Td>
                <Td align="right">{formatPercent(segment.rates.qualifiedRate)}</Td>
                <Td align="right">{formatPercent(segment.rates.referralRate)}</Td>
                <Td align="right">{formatYen(segment.economics.estimatedRevenue)}</Td>
                <Td align="right">{formatYen(segment.economics.salesIncentives)}</Td>
                <Td align="right">{formatYen(segment.economics.contributionMargin)}</Td>
                <Td
                  align="right"
                  className={
                    segment.economics.grossProfitPerSalesHour >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }
                >
                  {formatYen(segment.economics.grossProfitPerSalesHour)}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <p className="mt-3 text-xs text-ink-500">
          将来的には、この構造のまま「その営業担当が獲得した候補者の90日LTV」を評価軸に追加できます
          （candidate_attributions × revenue_events で算出可能）。
        </p>
      </Card>

      <Card title="粗利 / Sales Hour">
        <ComparisonChart
          data={segments.map((segment) => ({
            label: segment.label,
            value: Math.round(segment.economics.grossProfitPerSalesHour),
          }))}
          valueLabel="円/h"
        />
      </Card>
    </div>
  );
}
