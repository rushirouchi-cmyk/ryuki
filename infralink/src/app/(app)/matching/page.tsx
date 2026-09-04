import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { Forbidden } from '@/components/forbidden';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { parseJson, parseList } from '@/lib/json';
import { buildProfile } from '@/lib/domain/structuring';
import { similarCandidateOutcomes } from '@/lib/domain/knowledge';
import { anonymizeProfile } from '@/lib/domain/anonymize';
import { Badge, Card, ConfidenceBadge, Empty, PageHeader, ScoreBreakdown, ScoreChip } from '@/components/ui';
import { RunAgentButton } from '@/components/candidate-forms';
import { formatDate } from '@/lib/domain/dates';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

/**
 * AI Matching 画面 (§28)。
 * 候補者を選ぶと PORTERS 内求人と WEB 上企業の両方を順位付きで表示する。
 */
export default async function MatchingPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  if (!can(user, 'candidate:read_all')) return <Forbidden needed="candidate:read_all" />;
  const params = await searchParams;
  const candidateId = one(params.candidateId);

  const candidates = await prisma.candidate.findMany({
    where: { status: 'active' },
    select: { id: true, name: true, rank: true, phase: true },
    orderBy: { name: 'asc' },
  });

  const selectedId = candidateId || candidates[0]?.id;
  if (!selectedId) {
    return (
      <>
        <PageHeader title="AI Matching" />
        <div className="p-6">
          <Empty>候補者が登録されていません。</Empty>
        </div>
      </>
    );
  }

  const candidate = await prisma.candidate.findUnique({
    where: { id: selectedId },
    include: {
      careers: true,
      skills: true,
      qualifications: true,
      preference: true,
      matches: { include: { company: true, job: true }, orderBy: { matchScore: 'desc' } },
    },
  });
  if (!candidate) {
    return (
      <>
        <PageHeader title="AI Matching" />
        <div className="p-6"><Empty>候補者が見つかりません。</Empty></div>
      </>
    );
  }

  const profile = buildProfile(candidate);
  const anon = anonymizeProfile(profile);
  const similar = await similarCandidateOutcomes(profile);

  const internal = candidate.matches.filter((m) => m.matchType === 'internal_job').slice(0, 3);
  const web = candidate.matches.filter((m) => m.matchType === 'web_company').slice(0, 3);
  const findings = await prisma.webJobFinding.findMany({
    where: { id: { in: web.map((m) => m.findingId ?? '').filter(Boolean) } },
  });
  const findingById = new Map(findings.map((f) => [f.id, f]));

  return (
    <>
      <PageHeader
        title="AI Matching"
        description="候補者ごとに PORTERS 内求人と WEB 上企業を順位付けして表示します"
        actions={
          <div className="flex gap-2">
            <RunAgentButton candidateId={selectedId} agent="matching" label="求人再マッチ" />
            <RunAgentButton candidateId={selectedId} agent="research" label="WEB調査" />
          </div>
        }
      />

      <div className="grid gap-4 p-6 lg:grid-cols-4">
        <Card title="候補者を選択" className="lg:col-span-1">
          <ul className="max-h-[70vh] space-y-0.5 overflow-y-auto">
            {candidates.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/matching?candidateId=${c.id}`}
                  className={`block rounded px-2 py-1.5 text-xs hover:bg-[var(--bg-subtle)] ${
                    c.id === selectedId ? 'bg-[var(--bg-subtle)] font-medium' : ''
                  }`}
                >
                  {c.name}
                  {c.rank && <span className="ml-1 text-xxs text-[var(--text-muted)]">{c.rank}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-4 lg:col-span-3">
          <Card title={`${candidate.name} の匿名プロフィール`} subtitle="WEB調査・営業文面ではこの形式のみを使用します (§21)">
            <p className="rounded bg-[var(--bg-subtle)] p-2 text-xs">{anon.summary}</p>
            {profile.missingInfo.length > 0 && (
              <p className="mt-2 text-xxs text-crit-fg">
                不足情報: {profile.missingInfo.join(' / ')}
              </p>
            )}
          </Card>

          <Card title="PORTERS内 求人 TOP3">
            {internal.length === 0 ? (
              <Empty>マッチング未計算です。</Empty>
            ) : (
              <ol className="space-y-3">
                {internal.map((match, i) => {
                  const breakdown = parseJson<{
                    factors: { label: string; weight: number; earned: number; note: string }[];
                    adjustments: { label: string; points: number }[];
                  }>(match.breakdown, { factors: [], adjustments: [] });
                  return (
                    <li key={match.id} className="rounded border border-[var(--border)] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="tabular text-xs font-semibold">{i + 1}位</span>
                          <Link href={`/companies/${match.companyId}`} className="text-sm font-medium text-[var(--accent)] hover:underline">
                            {match.company.companyName}
                          </Link>
                          <span className="text-xs">{match.job?.jobTitle}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <ScoreChip score={match.matchScore} />
                          <ConfidenceBadge confidence={match.confidence} />
                        </div>
                      </div>
                      <div className="mt-2 grid gap-3 md:grid-cols-2">
                        <ScoreBreakdown factors={breakdown.factors} adjustments={breakdown.adjustments} />
                        <div className="space-y-2 text-xs">
                          <Section title="Match理由" tone="text-done-fg" items={parseList(match.matchReason)} />
                          <Section title="懸念事項" tone="text-warn-fg" items={parseList(match.risk)} />
                          <Section title="不足情報" tone="text-crit-fg" items={parseList(match.missingInfo)} />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>

          <Card title="WEB上 企業 TOP3" subtitle="§13 保有求人に無い転職可能性の探索">
            {web.length === 0 ? (
              <Empty>WEB調査が未実行です。</Empty>
            ) : (
              <ol className="space-y-2">
                {web.map((match, i) => {
                  const finding = match.findingId ? findingById.get(match.findingId) : null;
                  return (
                    <li key={match.id} className="rounded border border-[var(--border)] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="tabular text-xs font-semibold">{i + 1}位</span>
                          <Link href={`/companies/${match.companyId}`} className="text-sm font-medium text-[var(--accent)] hover:underline">
                            {match.company.companyName}
                          </Link>
                          {match.company.transactionStatus !== 'existing' && <Badge tone="accent">未取引</Badge>}
                        </div>
                        <div className="flex items-center gap-2">
                          <ScoreChip score={match.matchScore} size="sm" />
                          <ConfidenceBadge confidence={match.confidence} />
                        </div>
                      </div>
                      {finding && (
                        <p className="mt-1 text-xs">
                          <a href={finding.sourceUrl} target="_blank" rel="noreferrer" className="hover:underline">
                            {finding.jobTitle}
                          </a>
                          <span className="ml-2 text-xxs text-[var(--text-muted)]">
                            {finding.sourceType} / 最終確認 {formatDate(finding.lastVerifiedAt)}
                          </span>
                        </p>
                      )}
                      <div className="mt-1 space-y-1 text-xs">
                        <Section title="Match理由" tone="text-done-fg" items={parseList(match.matchReason)} />
                        <Section title="懸念事項" tone="text-warn-fg" items={parseList(match.risk)} />
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>

          <Card title="過去類似候補者の結果" subtitle={similar.definition}>
            {!similar.stats ? (
              <Empty>類似候補者の実績がまだありません。ルールベースのスコアのみで判断してください。</Empty>
            ) : (
              <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-5">
                <Metric label="類似候補者" value={`${similar.sampleSize}名`} />
                <Metric label="書類通過" value={`${similar.stats.documentPassed}名 (${similar.stats.documentPassRate}%)`} />
                <Metric label="一次面接通過" value={`${similar.stats.interview1Passed}名`} />
                <Metric label="内定" value={`${similar.stats.offered}名`} />
                <Metric label="承諾" value={`${similar.stats.accepted}名`} />
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function Section({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h4 className="text-xxs font-semibold text-[var(--text-muted)]">{title}</h4>
      <ul className={`list-inside list-disc ${tone}`}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[var(--border)] px-2 py-1.5">
      <div className="text-xxs text-[var(--text-muted)]">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}
