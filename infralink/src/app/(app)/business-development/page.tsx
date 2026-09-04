import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { Forbidden } from '@/components/forbidden';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { parseJson } from '@/lib/json';
import { buildWeeklyBdReport } from '@/lib/agents/reports';
import { Badge, Card, Empty, PageHeader, ScoreBreakdown, ScoreChip, Stat } from '@/components/ui';
import { OpportunityStatusForm, RerankButton } from '@/components/bd-forms';
import { BD_STATUS_LABELS, type BdStatus } from '@/lib/domain/enums';
import { formatDate } from '@/lib/domain/dates';

export const dynamic = 'force-dynamic';

/** Business Development 画面 (§29)。RA が「どこへ営業するか」を判断する画面。 */
export default async function BusinessDevelopmentPage() {
  const user = await requireUser();
  if (!can(user, 'bd:read')) return <Forbidden needed="bd:read" />;

  const [opportunities, ras, weekly] = await Promise.all([
    prisma.businessDevelopmentOpportunity.findMany({
      orderBy: { score: 'desc' },
      include: {
        ownerRa: true,
        company: { include: { webFindings: { where: { activeStatus: 'active' }, orderBy: { lastVerifiedAt: 'desc' } } } },
      },
    }),
    prisma.user.findMany({ where: { role: 'RA', active: true }, select: { id: true, name: true } }),
    buildWeeklyBdReport(),
  ]);

  const sRank = opportunities.filter((o) => o.score >= 85).length;
  const aRank = opportunities.filter((o) => o.score >= 70 && o.score < 85).length;
  const inProgress = opportunities.filter((o) => !['not_started', 'declined'].includes(o.status)).length;

  return (
    <>
      <PageHeader
        title="新規開拓"
        description="候補者起点で発見した未取引企業を、営業優先度順に表示します"
        actions={<RerankButton />}
      />

      <div className="space-y-4 p-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="開拓候補企業" value={opportunities.length} />
          <Stat label="Sランク (85+)" value={sRank} tone="done" />
          <Stat label="Aランク (70-84)" value={aRank} tone="warn" />
          <Stat label="営業進行中" value={inProgress} />
        </div>

        {opportunities.length === 0 ? (
          <Card>
            <Empty>
              開拓候補がまだありません。候補者詳細から「WEB調査」を実行し、その後 BD Agent を実行してください。
            </Empty>
          </Card>
        ) : (
          <div className="space-y-3">
            {opportunities.map((o, index) => {
              const factors = parseJson<{ label: string; weight: number; earned: number; note: string }[]>(
                o.breakdown,
                [],
              );
              return (
                <Card key={o.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="tabular text-xs font-semibold text-[var(--text-muted)]">{index + 1}位</span>
                        <Link href={`/companies/${o.companyId}`} className="text-sm font-semibold text-[var(--accent)] hover:underline">
                          {o.company.companyName}
                        </Link>
                        <ScoreChip score={o.score} />
                        <Badge tone="accent">候補者Match {o.matchingCandidateCount}名</Badge>
                        <Badge>S:{o.sRankCount}</Badge>
                        <Badge>A:{o.aRankCount}</Badge>
                        <Badge tone={o.status === 'contracted' ? 'done' : o.status === 'declined' ? 'crit' : 'normal'}>
                          {BD_STATUS_LABELS[o.status as BdStatus] ?? o.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        {o.company.industry ?? '業界不明'} / {o.company.location ?? '所在地不明'} / 情報取得日{' '}
                        {formatDate(o.company.webFindings[0]?.foundAt ?? o.createdAt)}
                      </p>
                    </div>
                    <OpportunityStatusForm
                      opportunityId={o.id}
                      status={o.status}
                      ownerRaId={o.ownerRaId}
                      ras={ras}
                    />
                  </div>

                  <div className="mt-3 grid gap-4 lg:grid-cols-3">
                    <div>
                      <h3 className="text-xxs font-semibold text-[var(--text-muted)]">Score 内訳 (§18)</h3>
                      <div className="mt-1">
                        <ScoreBreakdown factors={factors} />
                      </div>
                    </div>

                    <div className="space-y-2 text-xs lg:col-span-2">
                      <div>
                        <h3 className="text-xxs font-semibold text-[var(--text-muted)]">現在採用中の求人</h3>
                        {o.company.webFindings.length === 0 ? (
                          <p className="text-[var(--text-muted)]">公開求人情報は未取得</p>
                        ) : (
                          <ul className="list-inside list-disc">
                            {o.company.webFindings.slice(0, 3).map((f) => (
                              <li key={f.id}>
                                <a href={f.sourceUrl} target="_blank" rel="noreferrer" className="hover:underline">
                                  {f.jobTitle}
                                </a>
                                <span className="ml-1 text-xxs text-[var(--text-muted)]">
                                  ({f.sourceType} / 最終確認 {formatDate(f.lastVerifiedAt)})
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div>
                        <h3 className="text-xxs font-semibold text-[var(--text-muted)]">なぜ開拓すべきか</h3>
                        <p>{o.reason}</p>
                      </div>
                      <div className="grid gap-2 md:grid-cols-2">
                        <div>
                          <h3 className="text-xxs font-semibold text-[var(--text-muted)]">アプローチ切り口</h3>
                          <p>{o.approachAngle}</p>
                        </div>
                        <div>
                          <h3 className="text-xxs font-semibold text-[var(--text-muted)]">想定担当部署 / 推奨アクション</h3>
                          <p>
                            {o.targetDepartment} — {o.recommendedAction}
                          </p>
                        </div>
                      </div>
                      <div>
                        <h3 className="text-xxs font-semibold text-[var(--text-muted)]">
                          営業用メッセージ案（個人特定情報は含みません §21）
                        </h3>
                        <pre className="mt-0.5 whitespace-pre-wrap rounded bg-[var(--bg-subtle)] p-2 text-xs">
                          {o.draftMessage}
                        </pre>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <Card title="週次 Business Development Report" subtitle="§32 メール通知と同一内容">
          <pre className="whitespace-pre-wrap rounded bg-[var(--bg-subtle)] p-3 text-xs leading-relaxed">
            {weekly.text}
          </pre>
        </Card>
      </div>
    </>
  );
}
