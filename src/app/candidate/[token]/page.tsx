import Link from 'next/link';
import { notFound } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { getDb, schema } from '@/db/client';
import { Alert, Badge, Card } from '@/components/ui';
import { getCandidateByPublicToken } from '@/server/services/candidates';
import { getLatestDiagnosis } from '@/server/services/diagnosis';
import { consentText } from '@/server/services/referral-consent-text';
import {
  earliestInterviewSlot,
  formatDateTime,
  formatSalaryRange,
  REFERRAL_STATUS_LABELS,
} from '@/lib/format';
import type { DiagnosisResult } from '@/domain/diagnosis/types';
import { AgentSelectionForm, InterviewForm, LeadForm, type AgentChoice } from './forms';

export const dynamic = 'force-dynamic';

function reasonFor(breakdown: Record<string, number>): string {
  const entries = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
  const labels: Record<string, string> = {
    specialtyOccupation: 'あなたの推奨職種に強み',
    region: '希望勤務地をカバー',
    salaryBand: '年収レンジが得意',
    careerStage: 'キャリア段階が合う',
    historicalPerformance: '過去の決定実績が良好',
  };
  return entries
    .slice(0, 2)
    .map(([key]) => labels[key] ?? key)
    .join('／');
}

export default async function CandidatePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ registered?: string; booked?: string; referred?: string }>;
}) {
  const { token } = await params;
  const flags = await searchParams;
  const candidate = await getCandidateByPublicToken(token);
  if (!candidate) notFound();

  const db = getDb();
  const [diagnosis, interviews, recommendations, referrals] = await Promise.all([
    getLatestDiagnosis(candidate.id),
    db.query.interviews.findMany({
      where: eq(schema.interviews.candidateId, candidate.id),
      orderBy: [desc(schema.interviews.scheduledAt)],
    }),
    db.query.agentRecommendations.findMany({
      where: eq(schema.agentRecommendations.candidateId, candidate.id),
    }),
    db.query.referrals.findMany({ where: eq(schema.referrals.candidateId, candidate.id) }),
  ]);

  const result = diagnosis?.result as unknown as DiagnosisResult | undefined;
  const agentCompanies = await db.query.agentCompanies.findMany();
  const agentById = new Map(agentCompanies.map((a) => [a.id, a]));
  const occupations = await db.query.occupations.findMany();
  const occupationById = new Map(occupations.map((o) => [o.id, o]));

  const agentChoices: AgentChoice[] = recommendations
    .sort((a, b) => a.rankPosition - b.rankPosition)
    .map((reco) => {
      const agent = agentById.get(reco.agentCompanyId);
      return {
        id: reco.agentCompanyId,
        name: agent?.name ?? '—',
        score: reco.score,
        specialties: (agent?.specialtyOccupationIds ?? [])
          .map((id) => occupationById.get(id)?.name)
          .filter((name): name is string => Boolean(name)),
        reason: reasonFor(reco.breakdown),
      };
    });

  const earliestSlot = earliestInterviewSlot();
  const isLead = Boolean(candidate.leadRegisteredAt);
  const hasInterview = interviews.length > 0;
  const hasReferral = referrals.length > 0;

  return (
    <main className="mx-auto min-h-screen max-w-md bg-white px-6 py-8">
      <Link href={`/diagnosis/result/${token}`} className="text-xs text-brand-600 underline">
        ← 診断結果に戻る
      </Link>

      <h1 className="mt-4 text-xl font-bold text-ink-900">キャリア相談・求人紹介</h1>
      {result && (
        <p className="tabular mt-1 text-xs text-ink-500">
          想定年収レンジ {formatSalaryRange(result.estimatedSalaryLow, result.estimatedSalaryHigh)} / 市場価値ランク{' '}
          {result.valueRank}
        </p>
      )}

      <div className="mt-6 space-y-6">
        {flags.registered && <Alert tone="success">連絡先を登録しました。続けて面談日時をお選びください。</Alert>}
        {flags.booked && <Alert tone="success">面談を予約しました。おすすめのエージェントをご確認ください。</Alert>}
        {flags.referred && <Alert tone="success">選択したエージェントへ紹介を依頼しました。</Alert>}

        {/* Step 1 — contact registration */}
        <Card
          title="1. 連絡先の登録"
          description={isLead ? '登録済みです' : 'より詳しい診断と求人紹介に必要です'}
        >
          {isLead ? (
            <p className="text-sm text-ink-700">
              ご登録ありがとうございます。（{formatDateTime(candidate.leadRegisteredAt)}）
            </p>
          ) : (
            <LeadForm token={token} />
          )}
        </Card>

        {/* Step 2 — interview booking */}
        {isLead && (
          <Card title="2. キャリア面談の予約" description="専任アドバイザーが診断結果をもとにご説明します">
            {hasInterview ? (
              <ul className="space-y-2 text-sm text-ink-700">
                {interviews.map((interview) => (
                  <li key={interview.id} className="flex items-center justify-between gap-3">
                    <span className="tabular">{formatDateTime(interview.scheduledAt)}</span>
                    <Badge tone={interview.status === 'completed' ? 'success' : 'brand'}>
                      {interview.status === 'completed' ? '実施済み' : '予約済み'}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <InterviewForm token={token} earliestSlot={earliestSlot} />
            )}
          </Card>
        )}

        {/* Step 3 — agent selection & consent */}
        {isLead && hasInterview && (
          <Card
            title="3. 転職エージェントの選択"
            description="紹介先はご自身でお選びいただきます。選択されていない会社へ情報は提供されません。"
          >
            {hasReferral ? (
              <ul className="space-y-2 text-sm text-ink-700">
                {referrals.map((referral) => (
                  <li key={referral.id} className="flex items-center justify-between gap-3">
                    <span>{agentById.get(referral.agentCompanyId)?.name}</span>
                    <Badge tone="brand">{REFERRAL_STATUS_LABELS[referral.status] ?? referral.status}</Badge>
                  </li>
                ))}
              </ul>
            ) : agentChoices.length > 0 ? (
              <AgentSelectionForm
                token={token}
                agents={agentChoices}
                consentText={consentText('{agent}')}
              />
            ) : (
              <p className="text-sm text-ink-500">
                現在ご紹介できるエージェントを準備中です。面談時にご案内します。
              </p>
            )}
          </Card>
        )}
      </div>

      <p className="mt-8 text-[11px] leading-relaxed text-ink-500">
        個人情報は、あなたが選択したエージェントにのみ提供されます。同意の撤回をご希望の場合は、
        担当アドバイザーへお問い合わせください。
      </p>
    </main>
  );
}
