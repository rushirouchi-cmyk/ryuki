import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { Forbidden } from '@/components/forbidden';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { buildDailyReport, buildFunnelSnapshot } from '@/lib/agents/reports';
import { AlertBadge, Badge, Card, Cell, Empty, PageHeader, Row, ScoreChip, Stat, Table } from '@/components/ui';
import { FUNNEL_PHASES, PHASE_LABELS } from '@/lib/domain/enums';
import { formatDate } from '@/lib/domain/dates';

export const dynamic = 'force-dynamic';

/** Executive Dashboard (§24)。経営者が最初に見る画面。 */
export default async function ExecutiveDashboard() {
  const user = await requireUser();
  if (!can(user, 'alert:read_all')) return <Forbidden needed="alert:read_all" />;

  const weekAgo = new Date(Date.now() - 7 * 86_400_000);

  const [report, snapshot, newProspects, topOpportunities, criticalAlerts, webFindingsThisWeek] =
    await Promise.all([
      buildDailyReport(),
      buildFunnelSnapshot(),
      prisma.company.count({ where: { transactionStatus: 'unknown', createdAt: { gte: weekAgo } } }),
      prisma.businessDevelopmentOpportunity.findMany({
        orderBy: { score: 'desc' },
        take: 5,
        include: { company: true },
      }),
      prisma.aiAlert.findMany({
        where: { status: { in: ['open', 'escalated'] }, alertLevel: 3 },
        include: { candidate: true, ca: true },
        orderBy: { detectedAt: 'asc' },
        take: 8,
      }),
      prisma.webJobFinding.count({ where: { foundAt: { gte: weekAgo } } }),
    ]);

  const sRank = topOpportunities.filter((o) => o.score >= 85).length;
  const aRank = topOpportunities.filter((o) => o.score >= 70 && o.score < 85).length;
  const funnelCounts = snapshot.phases.filter((p) => FUNNEL_PHASES.includes(p.key));
  const maxCount = Math.max(1, ...funnelCounts.map((p) => p.count));

  return (
    <>
      <PageHeader
        title="Executive Dashboard"
        description={`${formatDate(new Date())} 時点 / AI が検知した状況と推奨アクション`}
      />

      <div className="space-y-4 p-6">
        {/* --------------------------------------------------- Candidate Management */}
        <section>
          <h2 className="mb-2 text-xs font-semibold text-[var(--text-muted)]">CANDIDATE MANAGEMENT</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat label="稼働候補者" value={report.activeCandidates} />
            <Stat label="正常" value={report.normal} tone="done" hint="○ 期限内" />
            <Stat label="要対応" value={report.needsAttention} tone="warn" hint="△ 期限接近" />
            <Stat label="遅延" value={report.late} tone="late" hint="! 期限超過" />
            <Stat label="重大遅延" value={report.critical} tone="crit" hint="■ 即時対応" />
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* ------------------------------------------------------------ CA 別 */}
          <Card title="CA別 状況" subtitle="遅延・重大の多い順に確認">
            {report.caRows.length === 0 ? (
              <Empty>CA が登録されていません。</Empty>
            ) : (
              <Table head={['CA', '稼働', '本日Action', '期限超過', '重大', '応募', '面接', '内定', '承諾']}>
                {[...report.caRows]
                  .sort((a, b) => b.critical - a.critical || b.overdue - a.overdue)
                  .map((row) => (
                    <Row key={row.caId}>
                      <Cell className="font-medium">{row.caName}</Cell>
                      <Cell className="tabular">{row.activeCandidates}</Cell>
                      <Cell className="tabular">{row.todayActions}</Cell>
                      <Cell className="tabular">
                        {row.overdue > 0 ? <span className="text-late-fg">! {row.overdue}</span> : 0}
                      </Cell>
                      <Cell className="tabular">
                        {row.critical > 0 ? <span className="text-crit-fg">■ {row.critical}</span> : 0}
                      </Cell>
                      <Cell className="tabular">{row.applications}</Cell>
                      <Cell className="tabular">{row.interviews}</Cell>
                      <Cell className="tabular">{row.offers}</Cell>
                      <Cell className="tabular">{row.accepted}</Cell>
                    </Row>
                  ))}
              </Table>
            )}
          </Card>

          {/* -------------------------------------------------- Recruitment Funnel */}
          <Card title="Recruitment Funnel" subtitle="現在のフェーズ分布">
            <div className="space-y-1.5">
              {funnelCounts.map((phase) => (
                <div key={phase.key} className="flex items-center gap-2">
                  <span className="w-24 shrink-0 text-xs">{PHASE_LABELS[phase.key]}</span>
                  <div className="h-4 flex-1 rounded bg-[var(--bg-subtle)]">
                    <div
                      className="h-4 rounded bg-[var(--accent)]"
                      style={{ width: `${(phase.count / maxCount) * 100}%` }}
                      aria-hidden
                    />
                  </div>
                  <span className="tabular w-8 text-right text-xs">{phase.count}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 border-t border-[var(--border)] pt-3 text-center">
              <div>
                <div className="text-xxs text-[var(--text-muted)]">書類通過率</div>
                <div className="tabular text-sm font-semibold">{snapshot.funnel.documentPassRate}%</div>
              </div>
              <div>
                <div className="text-xxs text-[var(--text-muted)]">面接通過率</div>
                <div className="tabular text-sm font-semibold">{snapshot.funnel.interviewPassRate}%</div>
              </div>
              <div>
                <div className="text-xxs text-[var(--text-muted)]">内定率</div>
                <div className="tabular text-sm font-semibold">{snapshot.funnel.offerRate}%</div>
              </div>
              <div>
                <div className="text-xxs text-[var(--text-muted)]">承諾率</div>
                <div className="tabular text-sm font-semibold">{snapshot.funnel.acceptanceRate}%</div>
              </div>
            </div>
          </Card>
        </div>

        {/* ------------------------------------------------------- AI New Business */}
        <section>
          <h2 className="mb-2 text-xs font-semibold text-[var(--text-muted)]">AI NEW BUSINESS</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="今週発見した未取引企業" value={newProspects} />
            <Stat label="Sランク開拓企業" value={sRank} tone="done" hint="Score 85+" />
            <Stat label="Aランク開拓企業" value={aRank} tone="warn" hint="Score 70-84" />
            <Stat label="候補者起点で発見した求人" value={webFindingsThisWeek} />
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card
            title="重大アラート"
            subtitle="経営判断が必要な項目"
            actions={
              <Link href="/alerts" className="text-xxs text-[var(--accent)] hover:underline">
                すべて見る
              </Link>
            }
          >
            {criticalAlerts.length === 0 ? (
              <Empty>重大アラートはありません。</Empty>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {criticalAlerts.map((alert) => (
                  <li key={alert.id} className="py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <AlertBadge level={3} />
                      <Link
                        href={`/candidates/${alert.candidateId}`}
                        className="text-xs font-medium text-[var(--accent)] hover:underline"
                      >
                        {alert.candidate?.name}様
                      </Link>
                      <Badge>担当: {alert.ca?.name ?? '未割当'}</Badge>
                      {alert.escalatedAt && <Badge tone="crit">■ エスカレーション済</Badge>}
                    </div>
                    <p className="mt-0.5 text-xxs text-[var(--text-muted)]">{alert.reason}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title="新規開拓 推奨企業"
            subtitle="Business Development Score 上位"
            actions={
              <Link href="/business-development" className="text-xxs text-[var(--accent)] hover:underline">
                すべて見る
              </Link>
            }
          >
            {topOpportunities.length === 0 ? (
              <Empty>開拓候補はまだありません。Market Research Agent を実行してください。</Empty>
            ) : (
              <Table head={['企業', 'Score', 'Match候補者', 'S', 'A']}>
                {topOpportunities.map((o) => (
                  <Row key={o.id}>
                    <Cell>
                      <Link href={`/companies/${o.companyId}`} className="text-[var(--accent)] hover:underline">
                        {o.company.companyName}
                      </Link>
                    </Cell>
                    <Cell>
                      <ScoreChip score={o.score} size="sm" />
                    </Cell>
                    <Cell className="tabular">{o.matchingCandidateCount}名</Cell>
                    <Cell className="tabular">{o.sRankCount}</Cell>
                    <Cell className="tabular">{o.aRankCount}</Cell>
                  </Row>
                ))}
              </Table>
            )}
          </Card>
        </div>

        {/* ---------------------------------------------------------- 日次レポート */}
        <Card title="本日の AI レポート" subtitle="§31 日次AIレポート (メール通知と同一内容)">
          <pre className="whitespace-pre-wrap rounded bg-[var(--bg-subtle)] p-3 text-xs leading-relaxed">
            {report.text}
          </pre>
        </Card>
      </div>
    </>
  );
}
