import Link from 'next/link';
import { Card, EmptyState, Stat } from '@/components/ui';
import { requireAgent } from '@/server/guards';
import { listAgentCandidates } from '@/server/services/agent-portal';
import { formatManYen, formatNumber, formatPercent } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function AgentHomePage() {
  const user = await requireAgent();
  const cards = await listAgentCandidates({
    userId: user.userId,
    role: user.role,
    agentCompanyId: user.agentCompanyId,
  });

  const count = (statuses: string[]) => cards.filter((card) => statuses.includes(card.status)).length;
  const accepted = count(['accepted', 'contacted', 'interview_scheduled', 'interview_completed', 'application', 'offer', 'joined']);
  const interviewed = count(['interview_completed', 'application', 'offer', 'joined']);
  const offers = count(['offer', 'joined']);
  const joined = count(['joined']);
  const offerSalaries = cards.map((card) => card.offerSalary).filter((v): v is number => typeof v === 'number');
  const avgOffer = offerSalaries.length
    ? Math.round(offerSalaries.reduce((sum, v) => sum + v, 0) / offerSalaries.length)
    : null;

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold text-ink-900">サマリー</h1>

      {cards.length === 0 ? (
        <Card>
          <EmptyState title="まだ送客された候補者がいません" description="候補者が同意のうえ選択すると、ここに表示されます。" />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="送客数" value={formatNumber(cards.length)} />
            <Stat label="受託" value={formatNumber(accepted)} sub={formatPercent(accepted / cards.length)} />
            <Stat label="面談実施" value={formatNumber(interviewed)} />
            <Stat label="内定" value={formatNumber(offers)} tone="brand" />
            <Stat label="入社" value={formatNumber(joined)} tone="positive" />
            <Stat label="平均提示年収" value={avgOffer ? formatManYen(avgOffer) : '—'} />
          </div>

          <Card title="直近の送客" description="最新10件">
            <ul className="divide-y divide-slate-100">
              {cards.slice(0, 10).map((card) => (
                <li key={card.referralId} className="py-2.5">
                  <Link
                    href={`/agent/candidates/${card.referralId}`}
                    className="flex items-center justify-between gap-3 text-sm hover:text-brand-600"
                  >
                    <span>
                      {card.ageBand ?? '—'} / {card.prefecture ?? '—'} / ランク {card.valueRank ?? '—'}
                    </span>
                    <span className="text-xs text-ink-500">{card.status}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
