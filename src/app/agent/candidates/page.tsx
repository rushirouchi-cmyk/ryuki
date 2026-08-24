import Link from 'next/link';
import { Badge, Card, EmptyState, Table, Td, Th } from '@/components/ui';
import { requireAgent } from '@/server/guards';
import { listAgentCandidates } from '@/server/services/agent-portal';
import { formatDate, formatSalaryRange, labelOf, REFERRAL_STATUS_LABELS } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function AgentCandidatesPage() {
  const user = await requireAgent();
  const cards = await listAgentCandidates({
    userId: user.userId,
    role: user.role,
    agentCompanyId: user.agentCompanyId,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold text-ink-900">候補者一覧</h1>
      <Card>
        {cards.length === 0 ? (
          <EmptyState title="送客された候補者がいません" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>送客日</Th>
                <Th>候補者</Th>
                <Th>年代 / 勤務地</Th>
                <Th>市場価値</Th>
                <Th>想定年収レンジ</Th>
                <Th>ステータス</Th>
              </tr>
            </thead>
            <tbody>
              {cards.map((card) => (
                <tr key={card.referralId} className="hover:bg-slate-50">
                  <Td>{formatDate(card.referredAt)}</Td>
                  <Td>
                    <Link href={`/agent/candidates/${card.referralId}`} className="text-brand-600 underline">
                      {card.fullName}
                    </Link>
                  </Td>
                  <Td>
                    {card.ageBand ?? '—'} / {card.prefecture ?? '—'}
                  </Td>
                  <Td>{card.valueRank ?? '—'}</Td>
                  <Td align="right">
                    {formatSalaryRange(card.estimatedSalaryLow, card.estimatedSalaryHigh)}
                  </Td>
                  <Td>
                    <Badge tone={card.status === 'joined' ? 'success' : 'neutral'}>
                      {labelOf(REFERRAL_STATUS_LABELS, card.status)}
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
