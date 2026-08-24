import { Card, EmptyState, Table, Td, Th } from '@/components/ui';
import { PeriodFilter } from '@/components/period-filter';
import { requireAdmin } from '@/server/guards';
import { loadAgentOccupationPerformance, loadAgentPerformance } from '@/server/services/agent-analytics';
import { resolvePeriod } from '@/lib/period';
import { formatManYen, formatNumber, formatPercent, formatYen } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function AdminAgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  await requireAdmin();
  const query = await searchParams;
  const period = resolvePeriod(query);
  const [rows, occupationRows] = await Promise.all([
    loadAgentPerformance(period.from, period.to),
    loadAgentOccupationPerformance(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ink-900">エージェント分析</h1>
          <p className="text-xs text-ink-500">送客先ごとの決定力と単価</p>
        </div>
        <PeriodFilter period={period} basePath="/admin/agents" query={query} />
      </div>

      <Card title="エージェント別パフォーマンス">
        {rows.every((row) => row.referrals === 0) ? (
          <EmptyState title="この期間の送客がありません" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>エージェント</Th>
                <Th align="right">送客</Th>
                <Th align="right">受託</Th>
                <Th align="right">面談実施</Th>
                <Th align="right">応募</Th>
                <Th align="right">内定</Th>
                <Th align="right">入社</Th>
                <Th align="right">内定率</Th>
                <Th align="right">入社率</Th>
                <Th align="right">平均提示年収</Th>
                <Th align="right">平均年収増</Th>
                <Th align="right">売上</Th>
                <Th align="right">確定売上</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.agentCompanyId}>
                  <Td>{row.agentName}</Td>
                  <Td align="right">{formatNumber(row.referrals)}</Td>
                  <Td align="right">{formatNumber(row.accepted)}</Td>
                  <Td align="right">{formatNumber(row.interviewCompleted)}</Td>
                  <Td align="right">{formatNumber(row.application)}</Td>
                  <Td align="right">{formatNumber(row.offer)}</Td>
                  <Td align="right">{formatNumber(row.joined)}</Td>
                  <Td align="right">{formatPercent(row.offerRate)}</Td>
                  <Td align="right">{formatPercent(row.joinRate)}</Td>
                  <Td align="right">{formatManYen(row.avgOfferSalary)}</Td>
                  <Td align="right" className="text-emerald-600">
                    {row.avgSalaryIncrease === null ? '—' : formatManYen(row.avgSalaryIncrease)}
                  </Td>
                  <Td align="right">{formatYen(row.revenue)}</Td>
                  <Td align="right">{formatYen(row.confirmedRevenue)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card
        title="エージェント × 職種"
        description="どのエージェントがどの職種で決まっているか。将来の Candidate × Agent ルーティングの学習データになります。"
      >
        {occupationRows.length === 0 ? (
          <EmptyState title="内定実績がまだありません" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>エージェント</Th>
                <Th>内定職種</Th>
                <Th align="right">内定数</Th>
                <Th align="right">入社数</Th>
                <Th align="right">平均提示年収</Th>
              </tr>
            </thead>
            <tbody>
              {occupationRows.map((row) => (
                <tr key={`${row.agentName}-${row.occupationName}`}>
                  <Td>{row.agentName}</Td>
                  <Td>{row.occupationName}</Td>
                  <Td align="right">{formatNumber(row.offers)}</Td>
                  <Td align="right">{formatNumber(row.joined)}</Td>
                  <Td align="right">{formatManYen(row.avgOfferSalary)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
