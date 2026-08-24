import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Alert, Badge, Card, RankBadge, Stat } from '@/components/ui';
import { requireAgent } from '@/server/guards';
import { getAgentCandidate } from '@/server/services/agent-portal';
import { formatDate, formatManYen, formatSalaryRange, labelOf, REFERRAL_STATUS_LABELS } from '@/lib/format';
import { StatusForm } from './status-form';

export const dynamic = 'force-dynamic';

export default async function AgentCandidateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAgent();
  const card = await getAgentCandidate(
    { userId: user.userId, role: user.role, agentCompanyId: user.agentCompanyId },
    id,
  );
  if (!card) notFound();

  return (
    <div className="space-y-6">
      <Link href="/agent/candidates" className="text-xs text-brand-600 underline">
        ← 候補者一覧に戻る
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card
            title="候補者カード"
            action={
              <Badge tone={card.status === 'joined' ? 'success' : 'brand'}>
                {labelOf(REFERRAL_STATUS_LABELS, card.status)}
              </Badge>
            }
          >
            {!card.piiVisible && (
              <div className="mb-4">
                <Alert tone="warning">
                  この候補者の同意が確認できないため、個人情報はマスク表示されています。
                </Alert>
              </div>
            )}

            <div className="flex items-start gap-4">
              <RankBadge rank={card.valueRank ?? 'C'} size="lg" />
              <div className="flex-1">
                <p className="text-lg font-bold text-ink-900">{card.fullName}</p>
                <p className="mt-0.5 text-xs text-ink-500">
                  {card.ageBand ?? '—'} / {card.prefecture ?? '—'} / 転職時期: {card.jobChangeTiming ?? '—'}
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <dt className="text-ink-500">メール</dt>
                  <dd className="text-ink-900">{card.email}</dd>
                  <dt className="text-ink-500">電話</dt>
                  <dd className="text-ink-900">{card.phone}</dd>
                  <dt className="text-ink-500">希望勤務地</dt>
                  <dd className="text-ink-900">{card.desiredPrefectures.join('・') || '—'}</dd>
                </dl>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <Stat label="現年収" value={formatManYen(card.currentSalary)} />
              <Stat
                label="市場年収レンジ"
                value={formatSalaryRange(card.estimatedSalaryLow, card.estimatedSalaryHigh)}
              />
            </div>

            {card.recommendedOccupations.length > 0 && (
              <div className="mt-5">
                <p className="text-xs font-semibold text-ink-500">推奨職種</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {card.recommendedOccupations.map((name) => (
                    <li key={name}>
                      <Badge tone="brand">{name}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="mt-5 text-xs text-ink-500">送客日: {formatDate(card.referredAt)}</p>
          </Card>

          {(card.offerSalary || card.joinedDate) && (
            <Card title="成果">
              <div className="grid grid-cols-2 gap-3">
                <Stat label="提示年収" value={formatManYen(card.offerSalary)} tone="positive" />
                <Stat label="入社日" value={card.joinedDate ?? '—'} />
              </div>
            </Card>
          )}
        </div>

        <Card title="ステータス更新" description="内定・入社の登録は年収診断モデルの学習データになります">
          <StatusForm
            referralId={card.referralId}
            currentStatus={card.status}
            defaults={{
              offerCompanyName: '',
              offerJobTitle: '',
              offerSalary: card.offerSalary ? String(card.offerSalary) : '',
              offerDate: '',
              joinedDate: card.joinedDate ?? '',
            }}
          />
        </Card>
      </div>
    </div>
  );
}
