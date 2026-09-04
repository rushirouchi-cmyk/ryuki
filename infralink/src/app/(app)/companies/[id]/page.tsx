import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { Forbidden } from '@/components/forbidden';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { computeFunnel } from '@/lib/domain/knowledge';
import { getBdWeights, getFocusAreas } from '@/lib/settings';
import { evaluateCompany } from '@/lib/agents/business-development';
import { candidatesForJob } from '@/lib/agents/matching';
import { Badge, Card, Cell, Empty, PageHeader, Row, ScoreBreakdown, ScoreChip, Stat, Table } from '@/components/ui';
import { APPLICATION_STAGE_LABELS, TRANSACTION_STATUS_LABELS, type ApplicationStage, type TransactionStatus } from '@/lib/domain/enums';
import { formatDate } from '@/lib/domain/dates';

export const dynamic = 'force-dynamic';

/** 企業詳細 (§27)。取引状況・実績・マッチ候補者・WEB採用情報・開拓理由を一画面に。 */
export default async function CompanyDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!can(user, 'company:read')) return <Forbidden needed="company:read" />;
  const { id } = await params;

  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      jobs: true,
      webFindings: { orderBy: { lastVerifiedAt: 'desc' } },
      applications: { include: { candidate: true, job: true }, orderBy: { applicationDate: 'desc' } },
      opportunities: { include: { ownerRa: true } },
    },
  });
  if (!company) notFound();

  const funnel = computeFunnel(company.applications);
  const [weights, focusAreas] = await Promise.all([getBdWeights(), getFocusAreas()]);
  const evaluation = await evaluateCompany(company.id, weights, focusAreas);

  // 保有求人がある場合は、その先頭求人に対するマッチ候補者を出す。
  const matchingCandidates = company.jobs[0] ? await candidatesForJob(company.jobs[0].id, 8) : [];

  return (
    <>
      <PageHeader
        title={company.companyName}
        description={`${company.industry ?? '業界不明'} / ${company.location ?? '所在地不明'}`}
        actions={
          <Badge tone={company.transactionStatus === 'existing' ? 'done' : 'accent'}>
            {TRANSACTION_STATUS_LABELS[company.transactionStatus as TransactionStatus] ?? company.transactionStatus}
          </Badge>
        }
      />

      <div className="grid gap-4 p-6 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat label="推薦数" value={funnel.applied} />
            <Stat label="書類通過率" value={`${funnel.documentPassRate}%`} tone="done" />
            <Stat label="面接通過率" value={`${funnel.interviewPassRate}%`} />
            <Stat label="内定率" value={`${funnel.offerRate}%`} />
            <Stat label="承諾率" value={`${funnel.acceptanceRate}%`} tone="done" />
          </div>

          <Card title="保有求人">
            {company.jobs.length === 0 ? (
              <Empty>PORTERS 内の求人はありません。</Empty>
            ) : (
              <Table head={['求人', '職種', '勤務地', '年収', '状態']}>
                {company.jobs.map((job) => (
                  <Row key={job.id}>
                    <Cell className="font-medium">{job.jobTitle}</Cell>
                    <Cell>{job.jobCategory ?? '—'}</Cell>
                    <Cell>{job.location ?? '—'}</Cell>
                    <Cell className="tabular">
                      {job.salaryMin ? `${(job.salaryMin / 10000).toFixed(0)}〜${((job.salaryMax ?? 0) / 10000).toFixed(0)}万` : '—'}
                    </Cell>
                    <Cell><Badge tone={job.status === 'open' ? 'done' : 'normal'}>{job.status}</Badge></Cell>
                  </Row>
                ))}
              </Table>
            )}
          </Card>

          <Card title="WEB上の採用情報" subtitle="§14 情報源・取得日・最終確認日を必ず保持">
            {company.webFindings.length === 0 ? (
              <Empty>WEB 上の採用情報は未取得です。</Empty>
            ) : (
              <Table head={['求人タイトル', '情報源', '取得日', '最終確認日', '状態', 'URL']}>
                {company.webFindings.map((f) => (
                  <Row key={f.id}>
                    <Cell className="max-w-[20rem] truncate">{f.jobTitle}</Cell>
                    <Cell>{f.sourceType}</Cell>
                    <Cell>{formatDate(f.foundAt)}</Cell>
                    <Cell>{formatDate(f.lastVerifiedAt)}</Cell>
                    <Cell>
                      <Badge tone={f.activeStatus === 'active' ? 'done' : 'warn'}>
                        {f.activeStatus === 'active' ? '○ 有効' : '△ 要再確認'}
                      </Badge>
                    </Cell>
                    <Cell>
                      <a href={f.sourceUrl} target="_blank" rel="noreferrer" className="text-[var(--accent)] hover:underline">
                        開く
                      </a>
                    </Cell>
                  </Row>
                ))}
              </Table>
            )}
          </Card>

          <Card title="過去推薦者">
            {company.applications.length === 0 ? (
              <Empty>推薦実績はありません。</Empty>
            ) : (
              <Table head={['候補者', '求人', '応募日', 'ステージ', '書類', '見送り理由']}>
                {company.applications.map((app) => (
                  <Row key={app.id}>
                    <Cell>
                      <Link href={`/candidates/${app.candidateId}`} className="text-[var(--accent)] hover:underline">
                        {app.candidate.name}
                      </Link>
                    </Cell>
                    <Cell>{app.job?.jobTitle ?? '—'}</Cell>
                    <Cell>{formatDate(app.applicationDate)}</Cell>
                    <Cell>
                      <Badge tone={app.currentStage === 'accepted' ? 'done' : app.currentStage === 'rejected' ? 'crit' : 'normal'}>
                        {APPLICATION_STAGE_LABELS[app.currentStage as ApplicationStage] ?? app.currentStage}
                      </Badge>
                    </Cell>
                    <Cell>{app.documentResult ?? '—'}</Cell>
                    <Cell className="max-w-[20rem] truncate">{app.rejectionReasonOriginal ?? '—'}</Cell>
                  </Row>
                ))}
              </Table>
            )}
          </Card>

          <Card title="マッチする現在候補者" subtitle={company.jobs[0] ? `対象求人: ${company.jobs[0].jobTitle}` : ''}>
            {matchingCandidates.length === 0 ? (
              <Empty>対象となる保有求人がないため算出できません。</Empty>
            ) : (
              <Table head={['候補者', 'ランク', 'Score', 'Confidence', '主な理由']}>
                {matchingCandidates.map(({ profile, result }) => (
                  <Row key={profile.id}>
                    <Cell>
                      <Link href={`/candidates/${profile.id}`} className="text-[var(--accent)] hover:underline">
                        {profile.name}
                      </Link>
                    </Cell>
                    <Cell>{profile.rank ?? '—'}</Cell>
                    <Cell><ScoreChip score={result.score} size="sm" /></Cell>
                    <Cell>{result.confidence}</Cell>
                    <Cell className="max-w-[24rem]">{result.reasons.slice(0, 2).join(' / ') || '—'}</Cell>
                  </Row>
                ))}
              </Table>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="企業基本情報">
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
              <dt className="text-[var(--text-muted)]">取引状況</dt>
              <dd className="text-right">{TRANSACTION_STATUS_LABELS[company.transactionStatus as TransactionStatus]}</dd>
              <dt className="text-[var(--text-muted)]">関係性</dt>
              <dd className="text-right">{company.relationshipStatus ?? '—'}</dd>
              <dt className="text-[var(--text-muted)]">従業員数</dt>
              <dd className="text-right tabular">{company.employeeCount ?? '—'}</dd>
              <dt className="text-[var(--text-muted)]">Web</dt>
              <dd className="truncate text-right">
                {company.website ? (
                  <a href={company.website} target="_blank" rel="noreferrer" className="text-[var(--accent)] hover:underline">
                    サイト
                  </a>
                ) : (
                  '—'
                )}
              </dd>
            </dl>
            {company.note && <p className="mt-2 text-xxs text-[var(--text-muted)]">{company.note}</p>}
          </Card>

          {evaluation && (
            <Card title="新規開拓 評価" subtitle="§18 Business Development Score">
              <div className="mb-2 flex items-center gap-2">
                <ScoreChip score={evaluation.score} />
                <Badge tone="accent">Match候補者 {evaluation.matchingCandidateCount}名</Badge>
                <Badge>S:{evaluation.sRankCount}</Badge>
                <Badge>A:{evaluation.aRankCount}</Badge>
              </div>
              <ScoreBreakdown factors={evaluation.factors} />
              <div className="mt-3 space-y-2 border-t border-[var(--border)] pt-3 text-xs">
                <div>
                  <h4 className="text-xxs font-semibold text-[var(--text-muted)]">開拓すべき理由</h4>
                  <p>{evaluation.reason}</p>
                </div>
                <div>
                  <h4 className="text-xxs font-semibold text-[var(--text-muted)]">アプローチ切り口</h4>
                  <p>{evaluation.approachAngle}</p>
                </div>
                <div>
                  <h4 className="text-xxs font-semibold text-[var(--text-muted)]">想定担当部署</h4>
                  <p>{evaluation.targetDepartment}</p>
                </div>
                <div>
                  <h4 className="text-xxs font-semibold text-[var(--text-muted)]">推奨アクション</h4>
                  <p>{evaluation.recommendedAction}</p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
