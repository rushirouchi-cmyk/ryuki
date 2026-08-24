import { Card, Table, Td, Th } from '@/components/ui';
import { PeriodFilter } from '@/components/period-filter';
import { FunnelChart } from '@/components/funnel-chart';
import { requireAdmin } from '@/server/guards';
import { loadCohortDataset, segmentAll } from '@/server/services/analytics';
import { resolvePeriod } from '@/lib/period';
import { formatNumber, formatPercent, formatYen } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function AdminFunnelPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  await requireAdmin();
  const query = await searchParams;
  const period = resolvePeriod(query);
  const dataset = await loadCohortDataset({ from: period.from, to: period.to });
  const overall = segmentAll(dataset);
  const c = overall.counts;

  const stages: { label: string; count: number; previous: number | null }[] = [
    { label: '声掛け (Approach)', count: c.approaches, previous: null },
    { label: '立ち止まり (Stop)', count: c.stops, previous: c.approaches },
    { label: 'QR読取 (Scan)', count: c.qr_scanned, previous: c.stops },
    { label: '診断開始', count: c.diagnosis_started, previous: c.qr_scanned },
    { label: '診断完了', count: c.diagnosis_completed, previous: c.diagnosis_started },
    { label: 'リード登録', count: c.lead_registered, previous: c.diagnosis_completed },
    { label: '面談予約', count: c.interview_booked, previous: c.lead_registered },
    { label: '面談実施', count: c.interview_completed, previous: c.interview_booked },
    { label: '有望候補者', count: c.candidate_qualified, previous: c.diagnosis_completed },
    { label: 'エージェント送客', count: c.agent_referred, previous: c.candidate_qualified },
    { label: '内定', count: c.offer_received, previous: c.agent_referred },
    { label: '入社', count: c.joined, previous: c.offer_received },
  ];

  const totalCost = overall.economics.totalCost;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ink-900">ファネル</h1>
          <p className="text-xs text-ink-500">candidate_events から算出（{period.label}のシフトコホート）</p>
        </div>
        <PeriodFilter period={period} basePath="/admin/funnel" query={query} />
      </div>

      <Card title="ステージ別の到達と単価">
        <Table>
          <thead>
            <tr>
              <Th>ステージ</Th>
              <Th align="right">人数</Th>
              <Th align="right">直前からの転換率</Th>
              <Th align="right">先頭からの通過率</Th>
              <Th align="right">獲得単価</Th>
            </tr>
          </thead>
          <tbody>
            {stages.map((stage) => (
              <tr key={stage.label}>
                <Td>{stage.label}</Td>
                <Td align="right">{formatNumber(stage.count)}</Td>
                <Td align="right">
                  {stage.previous === null ? '—' : formatPercent(stage.previous ? stage.count / stage.previous : 0)}
                </Td>
                <Td align="right">
                  {c.approaches ? formatPercent(stage.count / c.approaches, 2) : '—'}
                </Td>
                <Td align="right">{stage.count > 0 ? formatYen(totalCost / stage.count) : '—'}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card title="ファネル可視化">
        <FunnelChart data={stages.map((stage) => ({ stage: stage.label, count: stage.count }))} />
      </Card>
    </div>
  );
}
