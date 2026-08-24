import Link from 'next/link';
import { notFound } from 'next/navigation';
import { desc } from 'drizzle-orm';
import { Alert, Badge, Card, RankBadge, Stat, Table, Td, Th } from '@/components/ui';
import { requireAdmin } from '@/server/guards';
import { getCandidateJourney } from '@/server/services/candidate-admin';
import { getDb, schema } from '@/db/client';
import { maskEmail, maskName, maskPhone } from '@/domain/auth/pii';
import {
  CANDIDATE_STATUS_LABELS,
  EVENT_LABELS,
  formatDateTime,
  formatManYen,
  formatSalaryRange,
  formatYen,
  INCENTIVE_STATUS_LABELS,
  labelOf,
  REFERRAL_STATUS_LABELS,
} from '@/lib/format';
import { AttributionForm } from './attribution-form';

export const dynamic = 'force-dynamic';

export default async function AdminCandidateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin();
  const journey = await getCandidateJourney(id);
  if (!journey) notFound();

  const { candidate, attribution, diagnosis, diagnosisResult, events, interviews, referrals, incentives, revenue, consents } =
    journey;

  const qrCodes = await getDb().query.qrCodes.findMany({
    with: { shift: true, location: true, salesUser: true },
    orderBy: [desc(schema.qrCodes.createdAt)],
    limit: 60,
  });

  return (
    <div className="space-y-6">
      <Link href="/admin/candidates" className="text-xs text-brand-600 underline">
        ← 候補者一覧に戻る
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ink-900">候補者 {candidate.id.slice(0, 8)}</h1>
          <p className="text-xs text-ink-500">
            取得日 {formatDateTime(candidate.createdAt)} ・ {candidate.ageBand ?? '—'} ・{' '}
            {candidate.prefecture ?? '—'}
          </p>
        </div>
        <Badge tone={candidate.qualified ? 'brand' : 'neutral'}>
          {labelOf(CANDIDATE_STATUS_LABELS, candidate.status)}
        </Badge>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Acquisition" description="QR × 営業担当 × 場所 × シフト">
          {attribution ? (
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-500">営業担当</dt>
                <dd className="font-medium">{attribution.salesUser?.displayName ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-500">場所</dt>
                <dd className="font-medium">{attribution.location?.venueName ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-500">シフト開始</dt>
                <dd>{formatDateTime(attribution.shift?.startTime)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-500">紐づけ方法</dt>
                <dd>{attribution.source}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-500">確定日時</dt>
                <dd>{formatDateTime(attribution.attributedAt)}</dd>
              </div>
              {attribution.overrideReason && (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  管理者修正: {attribution.overrideReason}
                </p>
              )}
            </dl>
          ) : (
            <Alert tone="warning">QR経由の獲得ではありません（アトリビューションなし）。</Alert>
          )}

          <div className="mt-5 border-t border-slate-100 pt-4">
            <AttributionForm
              candidateId={candidate.id}
              currentQrCodeId={attribution?.qrCodeId ?? null}
              qrCodes={qrCodes.map((qr) => ({
                id: qr.id,
                label: `${qr.salesUser?.displayName ?? '—'} / ${qr.location?.venueName ?? '—'} / ${formatDateTime(qr.shift?.startTime)}`,
              }))}
            />
          </div>
        </Card>

        <Card title="Diagnosis">
          {diagnosis ? (
            <>
              <div className="flex items-center gap-4">
                <RankBadge rank={diagnosis.valueRank ?? 'C'} size="lg" />
                <div>
                  <p className="tabular text-sm font-semibold">
                    {formatSalaryRange(diagnosis.estimatedSalaryLow, diagnosis.estimatedSalaryHigh)}
                  </p>
                  <p className="text-xs text-ink-500">
                    現在年収 {formatManYen(diagnosis.currentSalary)} / 適合度 {diagnosis.bestMatchScore}
                  </p>
                  <p className="text-xs text-ink-500">engine v{diagnosis.engineVersion}</p>
                </div>
              </div>
              {diagnosisResult && (
                <ul className="mt-4 space-y-1.5 text-xs">
                  {diagnosisResult.options.map((option) => (
                    <li key={option.occupationId} className="flex justify-between gap-3">
                      <span className={option.isCurrentOccupation ? 'text-ink-500' : 'text-ink-900'}>
                        {option.occupationName}
                        {option.isCurrentOccupation && '（現職）'}
                      </span>
                      <span className="tabular text-ink-500">
                        {option.matchScore} / {formatManYen(option.expectedSalary)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <Alert tone="info">診断は未完了です。</Alert>
          )}
        </Card>

        <Card title="個人情報 / 同意">
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-500">氏名</dt>
              <dd>{maskName(candidate.fullName)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-500">メール</dt>
              <dd>{maskEmail(candidate.email)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-500">電話</dt>
              <dd>{maskPhone(candidate.phone)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-[11px] text-ink-500">
            管理画面では既定でマスク表示します。原本はDBにのみ保持されます。
          </p>

          <div className="mt-4 border-t border-slate-100 pt-3">
            <p className="text-xs font-semibold text-ink-500">第三者提供同意</p>
            {consents.length === 0 ? (
              <p className="mt-1 text-xs text-ink-500">同意なし</p>
            ) : (
              <ul className="mt-1 space-y-1 text-xs">
                {consents.map((consent) => (
                  <li key={consent.id} className="flex justify-between gap-3">
                    <span>v{consent.consentVersion}</span>
                    <span className="text-ink-500">{formatDateTime(consent.grantedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="イベント履歴" description="candidate_events（分析の一次ソース）">
          <Table>
            <thead>
              <tr>
                <Th>日時</Th>
                <Th>イベント</Th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <Td>{formatDateTime(event.createdAt)}</Td>
                  <Td>{labelOf(EVENT_LABELS, event.eventType)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <div className="space-y-6">
          <Card title="面談・送客・成果">
            <ul className="space-y-2 text-sm">
              {interviews.map((interview) => (
                <li key={interview.id} className="flex justify-between gap-3">
                  <span>キャリア面談 {formatDateTime(interview.scheduledAt)}</span>
                  <Badge tone={interview.status === 'completed' ? 'success' : 'neutral'}>
                    {interview.status}
                  </Badge>
                </li>
              ))}
              {referrals.map((referral) => (
                <li key={referral.id} className="flex justify-between gap-3">
                  <span>
                    {referral.agentCompany?.name}
                    {referral.offerSalary && ` / 提示 ${formatManYen(referral.offerSalary)}`}
                  </span>
                  <Badge tone={referral.status === 'joined' ? 'success' : 'brand'}>
                    {labelOf(REFERRAL_STATUS_LABELS, referral.status)}
                  </Badge>
                </li>
              ))}
              {interviews.length === 0 && referrals.length === 0 && (
                <li className="text-xs text-ink-500">まだ面談・送客はありません。</li>
              )}
            </ul>
          </Card>

          <Card title="金額">
            <div className="grid grid-cols-2 gap-3">
              <Stat
                label="売上（想定含む）"
                value={formatYen(revenue.reduce((sum, row) => sum + row.amount, 0))}
              />
              <Stat
                label="営業インセンティブ"
                value={formatYen(incentives.reduce((sum, row) => sum + row.amount, 0))}
              />
            </div>
            {incentives.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs">
                {incentives.map((entry) => (
                  <li key={entry.id} className="flex justify-between gap-3">
                    <span>{labelOf(EVENT_LABELS, entry.eventType)}</span>
                    <span className="tabular text-ink-500">
                      {formatYen(entry.amount)} ・{labelOf(INCENTIVE_STATUS_LABELS, entry.status)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
