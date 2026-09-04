import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { Forbidden } from '@/components/forbidden';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { parseList, parseJson } from '@/lib/json';
import { buildProfile } from '@/lib/domain/structuring';
import { anonymizeProfile } from '@/lib/domain/anonymize';
import { similarCandidateOutcomes } from '@/lib/domain/knowledge';
import { buildCaInquiry } from '@/lib/agents/ca-supervisor';
import {
  ACTION_TYPE_LABELS,
  ALERT_TYPE_LABELS,
  APPLICATION_STAGE_LABELS,
  PHASE_LABELS,
  type ActionType,
  type AlertLevel,
  type AlertType,
  type ApplicationStage,
  type CandidatePhase,
} from '@/lib/domain/enums';
import { formatDate, formatDateTime } from '@/lib/domain/dates';
import {
  AlertBadge,
  Badge,
  Card,
  Cell,
  ConfidenceBadge,
  Empty,
  PageHeader,
  Row,
  ScoreBreakdown,
  ScoreChip,
  Table,
} from '@/components/ui';
import { AlertResponseForm, PhaseForm, RecordActionForm, RunAgentButton } from '@/components/candidate-forms';
import { RejectionTagForm } from '@/components/rejection-tag-form';

export const dynamic = 'force-dynamic';

/** 候補者詳細 (§26)。一画面で状況・AI解析・推奨・履歴を把握できるようにする。 */
export default async function CandidateDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!can(user, 'candidate:read_all')) return <Forbidden needed="candidate:read_all" />;
  const { id } = await params;

  const candidate = await prisma.candidate.findUnique({
    where: { id },
    include: {
      ownerCa: true,
      careers: { orderBy: { yearsExperience: 'desc' } },
      skills: true,
      qualifications: true,
      preference: true,
      actions: { orderBy: { actionDate: 'desc' }, take: 30, include: { ca: true } },
      applications: { include: { company: true, job: true }, orderBy: { applicationDate: 'desc' } },
      alerts: { where: { status: { in: ['open', 'escalated'] } }, orderBy: { alertLevel: 'desc' } },
      matches: {
        include: { company: true, job: true },
        orderBy: { matchScore: 'desc' },
      },
    },
  });
  if (!candidate) notFound();

  const profile = buildProfile(candidate);
  const anon = anonymizeProfile(profile);
  const similar = await similarCandidateOutcomes(profile);

  const internalMatches = candidate.matches.filter((m) => m.matchType === 'internal_job').slice(0, 5);
  const webMatches = candidate.matches.filter((m) => m.matchType === 'web_company').slice(0, 8);
  const webFindings = await prisma.webJobFinding.findMany({
    where: { id: { in: webMatches.map((m) => m.findingId ?? '').filter(Boolean) } },
  });
  const findingById = new Map(webFindings.map((f) => [f.id, f]));

  return (
    <>
      <PageHeader
        title={`${candidate.name}`}
        description={`${candidate.age ?? '—'}歳 / ${candidate.location ?? '—'} / 担当: ${candidate.ownerCa?.name ?? '未割当'}`}
        actions={
          <div className="flex items-center gap-2">
            <PhaseForm candidateId={candidate.id} phase={candidate.phase} />
            <RunAgentButton candidateId={candidate.id} agent="structuring" label="AI構造化" />
            <RunAgentButton candidateId={candidate.id} agent="matching" label="求人再マッチ" />
            <RunAgentButton candidateId={candidate.id} agent="research" label="WEB調査" />
          </div>
        }
      />

      <div className="grid gap-4 p-6 xl:grid-cols-3">
        {/* ------------------------------------------------------------- 左カラム */}
        <div className="space-y-4 xl:col-span-2">
          {candidate.alerts.length > 0 && (
            <Card title="AI アラート" subtitle="対応が必要な項目">
              <ul className="space-y-3">
                {candidate.alerts.map((alert) => (
                  <li key={alert.id} className="rounded border border-[var(--border)] p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <AlertBadge level={alert.alertLevel as AlertLevel} />
                      <span className="text-xs font-medium">
                        {ALERT_TYPE_LABELS[alert.alertType as AlertType] ?? alert.alertType}
                      </span>
                      <span className="text-xxs text-[var(--text-muted)]">
                        期限 {formatDateTime(alert.dueAt)} / 検知 {formatDate(alert.detectedAt)}
                      </span>
                      {alert.escalatedAt && <Badge tone="crit">■ 経営層へエスカレーション済</Badge>}
                    </div>
                    <p className="mt-1 text-xs">{alert.reason}</p>
                    <div className="mt-2">
                      <AlertResponseForm
                        alertId={alert.id}
                        question={buildCaInquiry({
                          candidateName: candidate.name,
                          dueAt: alert.dueAt ?? alert.detectedAt,
                          reason: alert.reason,
                        })}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title="PORTERS内 おすすめ求人" subtitle="§11 Match Score / §37 判断根拠を必ず表示">
            {internalMatches.length === 0 ? (
              <Empty>マッチング未計算です。「求人再マッチ」を実行してください。</Empty>
            ) : (
              <ul className="space-y-3">
                {internalMatches.map((match, index) => {
                  const breakdown = parseJson<{
                    factors: { label: string; weight: number; earned: number; note: string }[];
                    adjustments: { label: string; points: number }[];
                  }>(match.breakdown, { factors: [], adjustments: [] });
                  return (
                    <li key={match.id} className="rounded border border-[var(--border)] p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="tabular text-xxs text-[var(--text-muted)]">{index + 1}位</span>
                            <Link href={`/companies/${match.companyId}`} className="text-sm font-medium text-[var(--accent)] hover:underline">
                              {match.company.companyName}
                            </Link>
                          </div>
                          <p className="text-xs">{match.job?.jobTitle}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <ScoreChip score={match.matchScore} />
                          <ConfidenceBadge confidence={match.confidence} />
                        </div>
                      </div>

                      <div className="mt-2 grid gap-3 md:grid-cols-2">
                        <div>
                          <h4 className="text-xxs font-semibold text-[var(--text-muted)]">スコア内訳</h4>
                          <div className="mt-1">
                            <ScoreBreakdown factors={breakdown.factors} adjustments={breakdown.adjustments} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <ReasonList title="合う理由" tone="done" items={parseList(match.matchReason)} />
                          <ReasonList title="懸念" tone="warn" items={parseList(match.risk)} />
                          <ReasonList title="確認すべき事項 (不足情報)" tone="crit" items={parseList(match.missingInfo)} />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card
            title="WEB上 おすすめ企業 / 未取引企業候補"
            subtitle="§13〜§16 候補者起点で発見した採用可能性のある企業"
          >
            {webMatches.length === 0 ? (
              <Empty>WEB調査が未実行です。「WEB調査」を実行してください。</Empty>
            ) : (
              <Table head={['企業', '取引状況', '求人', '推定適合度', '情報源', '最終確認日']}>
                {webMatches.map((match) => {
                  const finding = match.findingId ? findingById.get(match.findingId) : null;
                  return (
                    <Row key={match.id}>
                      <Cell>
                        <Link href={`/companies/${match.companyId}`} className="text-[var(--accent)] hover:underline">
                          {match.company.companyName}
                        </Link>
                      </Cell>
                      <Cell>
                        {match.company.transactionStatus === 'existing' ? (
                          <Badge tone="done">既存取引</Badge>
                        ) : (
                          <Badge tone="accent">未取引 (開拓候補)</Badge>
                        )}
                      </Cell>
                      <Cell className="max-w-[18rem] truncate">
                        {finding ? (
                          <a href={finding.sourceUrl} target="_blank" rel="noreferrer" className="hover:underline">
                            {finding.jobTitle}
                          </a>
                        ) : (
                          '—'
                        )}
                      </Cell>
                      <Cell><ScoreChip score={match.matchScore} size="sm" /></Cell>
                      <Cell>{finding?.sourceType ?? '—'}</Cell>
                      <Cell>{formatDate(finding?.lastVerifiedAt)}</Cell>
                    </Row>
                  );
                })}
              </Table>
            )}
          </Card>

          <Card title="現在の選考企業">
            {candidate.applications.length === 0 ? (
              <Empty>選考中の企業はありません。</Empty>
            ) : (
              <div className="space-y-2">
                {candidate.applications.map((app) => (
                  <div key={app.id} className="rounded border border-[var(--border)] p-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/companies/${app.companyId}`} className="text-xs font-medium text-[var(--accent)] hover:underline">
                        {app.company.companyName}
                      </Link>
                      <span className="text-xs">{app.job?.jobTitle ?? '—'}</span>
                      <Badge tone={app.currentStage === 'rejected' ? 'crit' : app.currentStage === 'accepted' ? 'done' : 'normal'}>
                        {APPLICATION_STAGE_LABELS[app.currentStage as ApplicationStage] ?? app.currentStage}
                      </Badge>
                      <span className="text-xxs text-[var(--text-muted)]">応募 {formatDate(app.applicationDate)}</span>
                      {app.offerDeadline && <Badge tone="warn">△ 承諾期限 {formatDate(app.offerDeadline)}</Badge>}
                    </div>
                    {app.rejectionReasonOriginal && (
                      <div className="mt-2 rounded bg-[var(--bg-subtle)] p-2">
                        <p className="text-xxs font-semibold text-[var(--text-muted)]">
                          企業からの見送り理由（原文・編集不可）
                        </p>
                        <p className="mt-0.5 text-xs">{app.rejectionReasonOriginal}</p>
                        <div className="mt-2">
                          <RejectionTagForm
                            applicationId={app.id}
                            currentTag={app.rejectionReasonTag}
                            confirmed={Boolean(app.rejectionTagConfirmedBy)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="活動履歴">
            {candidate.actions.length === 0 ? (
              <Empty>活動履歴がありません。</Empty>
            ) : (
              <Table head={['日時', '種別', '実行者', 'メモ', '次回']}>
                {candidate.actions.map((action) => (
                  <Row key={action.id}>
                    <Cell className="whitespace-nowrap">{formatDateTime(action.actionDate)}</Cell>
                    <Cell>
                      <Badge>{ACTION_TYPE_LABELS[action.actionType as ActionType] ?? action.actionType}</Badge>
                    </Cell>
                    <Cell>
                      {action.actor === 'AI' ? <Badge tone="accent">AI</Badge> : (action.ca?.name ?? '—')}
                    </Cell>
                    <Cell className="max-w-md">{action.memo ?? '—'}</Cell>
                    <Cell className="whitespace-nowrap">
                      {action.nextAction ?? '—'}
                      {action.nextActionDate && (
                        <div className="text-xxs text-[var(--text-muted)]">{formatDate(action.nextActionDate)}</div>
                      )}
                    </Cell>
                  </Row>
                ))}
              </Table>
            )}
          </Card>
        </div>

        {/* ------------------------------------------------------------- 右カラム */}
        <div className="space-y-4">
          <Card title="次回 Action">
            <p className="text-sm font-medium">{candidate.nextAction ?? '未設定'}</p>
            <p className="text-xs text-[var(--text-muted)]">期限: {formatDate(candidate.nextActionDate)}</p>
            <p className="mt-1 text-xxs text-[var(--text-muted)]">
              最終接触: {formatDate(candidate.lastContactDate)}
            </p>
            <div className="mt-3 border-t border-[var(--border)] pt-3">
              <RecordActionForm candidateId={candidate.id} />
            </div>
          </Card>

          <Card title="基本情報">
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
              <Field label="フェーズ" value={PHASE_LABELS[candidate.phase as CandidatePhase] ?? candidate.phase} />
              <Field label="ランク" value={candidate.rank ?? '—'} />
              <Field label="現年収" value={candidate.currentSalary ? `${(candidate.currentSalary / 10000).toFixed(0)}万円` : '—'} />
              <Field label="希望年収" value={candidate.desiredSalary ? `${(candidate.desiredSalary / 10000).toFixed(0)}万円` : '—'} />
              <Field label="転職時期" value={candidate.jobChangeTiming ?? '—'} />
              <Field label="データ元" value={candidate.source ?? '—'} />
              <Field label="PORTERS ID" value={candidate.portersId ?? '—'} />
              <Field
                label="情報開示同意"
                value={candidate.disclosureConsent ? '○ 同意あり' : '× 未同意'}
              />
            </dl>
            {!candidate.disclosureConsent && (
              <p className="mt-2 rounded border border-warn-line bg-warn-bg px-2 py-1 text-xxs text-warn-fg">
                △ 本人同意が未取得のため、企業への情報開示はできません (§21)。
              </p>
            )}
          </Card>

          <Card title="AI 解析" subtitle={`最終構造化: ${formatDateTime(candidate.aiStructuredAt)}`}>
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-xxs text-[var(--text-muted)]">匿名プロフィール（WEB調査・営業文面で使用）</span>
                <p className="mt-0.5 rounded bg-[var(--bg-subtle)] p-2">{anon.summary}</p>
              </div>
              <div>
                <span className="text-xxs text-[var(--text-muted)]">総経験年数</span>
                <p>{Math.round(profile.totalYearsExperience)}年</p>
              </div>
              {profile.missingInfo.length > 0 && (
                <div>
                  <span className="text-xxs text-[var(--text-muted)]">不足情報 (§38)</span>
                  <ul className="mt-0.5 list-inside list-disc text-crit-fg">
                    {profile.missingInfo.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Card>

          <Card title="類似候補者の過去実績" subtitle={similar.definition}>
            {similar.sampleSize === 0 || !similar.stats ? (
              <Empty>類似候補者の実績データがまだありません。</Empty>
            ) : (
              <div className="space-y-1 text-xs">
                <p>類似候補者: {similar.sampleSize}名</p>
                <p>書類通過: {similar.stats.documentPassed}名 ({similar.stats.documentPassRate}%)</p>
                <p>一次面接通過: {similar.stats.interview1Passed}名</p>
                <p>内定: {similar.stats.offered}名</p>
                <p>承諾: {similar.stats.accepted}名</p>
                {!similar.reliable && (
                  <p className="mt-1 rounded border border-warn-line bg-warn-bg px-2 py-1 text-xxs text-warn-fg">
                    △ 母数が少ないため参考値です (Match Score には反映していません)。
                  </p>
                )}
              </div>
            )}
          </Card>

          <Card title="スキル・資格">
            <div className="flex flex-wrap gap-1">
              {candidate.skills.map((skill) => (
                <span key={skill.id} title={skill.evidence ?? ''}>
                  <Badge tone={skill.source === 'human' ? 'normal' : 'accent'}>
                    {skill.skillName}
                    {skill.source === 'ai' && <span className="ml-1 opacity-60">AI</span>}
                  </Badge>
                </span>
              ))}
              {candidate.skills.length === 0 && <Empty>スキル未登録</Empty>}
            </div>
            <div className="mt-2 flex flex-wrap gap-1 border-t border-[var(--border)] pt-2">
              {candidate.qualifications.map((q) => (
                <Badge key={q.id} tone="done">
                  {q.qualificationName}
                </Badge>
              ))}
              {candidate.qualifications.length === 0 && <Empty>資格未登録</Empty>}
            </div>
          </Card>

          <Card title="職務経歴">
            <ul className="space-y-2 text-xs">
              {candidate.careers.map((career) => (
                <li key={career.id} className="border-l-2 border-[var(--border)] pl-2">
                  <p className="font-medium">{career.companyName}</p>
                  <p className="text-xxs text-[var(--text-muted)]">
                    {career.industry} / {career.jobCategory} / {career.jobTitle}
                  </p>
                  <p className="text-xxs text-[var(--text-muted)]">
                    {formatDate(career.startDate)} 〜 {career.isCurrent ? '現在' : formatDate(career.endDate)}（
                    {career.yearsExperience ?? '—'}年）
                  </p>
                  {career.description && <p className="mt-0.5">{career.description}</p>}
                </li>
              ))}
              {candidate.careers.length === 0 && <Empty>職務経歴が未登録です。</Empty>}
            </ul>
          </Card>

          <Card title="希望条件">
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
              <Field label="希望勤務地" value={profile.preference.desiredLocations.join('・') || '—'} />
              <Field label="希望職種" value={profile.preference.desiredJobs.join('・') || '—'} />
              <Field label="許容職種" value={profile.preference.acceptableJobs.join('・') || '—'} />
              <Field label="NG職種" value={profile.preference.ngJobs.join('・') || '—'} />
              <Field label="転勤" value={profile.preference.transferAllowed ?? '不明'} />
              <Field label="出張" value={profile.preference.businessTripAllowed ?? '不明'} />
              <Field label="夜勤" value={profile.preference.nightShiftAllowed ?? '不明'} />
              <Field label="優先順位" value={profile.preference.priorities.join(' > ') || '—'} />
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-[var(--text-muted)]">{label}</dt>
      <dd className="text-right">{value}</dd>
    </>
  );
}

function ReasonList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: 'done' | 'warn' | 'crit';
}) {
  if (items.length === 0) return null;
  const icon = tone === 'done' ? '+' : tone === 'warn' ? '△' : '?';
  const color = tone === 'done' ? 'text-done-fg' : tone === 'warn' ? 'text-warn-fg' : 'text-crit-fg';
  return (
    <div>
      <h4 className="text-xxs font-semibold text-[var(--text-muted)]">{title}</h4>
      <ul className={`mt-0.5 space-y-0.5 text-xs ${color}`}>
        {items.map((item) => (
          <li key={item}>
            <span aria-hidden className="mr-1">
              {icon}
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
