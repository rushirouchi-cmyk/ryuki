import { desc, eq } from 'drizzle-orm';
import { getDb, schema } from '@/db/client';
import { Badge, Card, EmptyState, Stat, Table, Td, Th } from '@/components/ui';
import { requireSales } from '@/server/guards';
import { sumApprovedAmount, sumEarnedAmount } from '@/domain/incentive/engine';
import { EVENT_LABELS, formatDate, formatYen, INCENTIVE_STATUS_LABELS, labelOf } from '@/lib/format';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<string, 'neutral' | 'brand' | 'success' | 'danger'> = {
  pending: 'neutral',
  approved: 'brand',
  paid: 'success',
  rejected: 'danger',
};

export default async function SalesIncentivesPage() {
  const user = await requireSales();
  const entries = await getDb().query.incentiveLedger.findMany({
    where: eq(schema.incentiveLedger.salesUserId, user.userId),
    orderBy: [desc(schema.incentiveLedger.occurredAt)],
    limit: 200,
  });

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-bold text-ink-900">報酬明細</h1>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="確定済み（承認・支払）" value={formatYen(sumApprovedAmount(entries))} tone="brand" />
        <Stat label="承認待ちを含む合計" value={formatYen(sumEarnedAmount(entries))} />
      </div>

      <Card title="明細" description="直近200件">
        {entries.length === 0 ? (
          <EmptyState title="まだ報酬明細がありません" description="診断完了以降の成果が自動で計上されます。" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>発生日</Th>
                <Th>成果</Th>
                <Th align="right">金額</Th>
                <Th>状態</Th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <Td>{formatDate(entry.occurredAt)}</Td>
                  <Td>{labelOf(EVENT_LABELS, entry.eventType)}</Td>
                  <Td align="right">{formatYen(entry.amount)}</Td>
                  <Td>
                    <Badge tone={STATUS_TONE[entry.status] ?? 'neutral'}>
                      {labelOf(INCENTIVE_STATUS_LABELS, entry.status)}
                    </Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
