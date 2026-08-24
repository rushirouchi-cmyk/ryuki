import { Alert, Card, Stat } from '@/components/ui';
import { PeriodFilter } from '@/components/period-filter';
import { FunnelChart } from '@/components/funnel-chart';
import { requireAdmin } from '@/server/guards';
import { loadCohortDataset, loadPeriodFunnel, segmentAll } from '@/server/services/analytics';
import { computeRates } from '@/domain/analytics/funnel';
import { resolvePeriod } from '@/lib/period';
import { EVENT_LABELS, formatNumber, formatPercent, formatYen, labelOf } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  await requireAdmin();
  const query = await searchParams;
  const period = resolvePeriod(query);

  const [dataset, periodFunnel] = await Promise.all([
    loadCohortDataset({ from: period.from, to: period.to }),
    loadPeriodFunnel(period.from, period.to),
  ]);
  const overall = segmentAll(dataset);
  const periodRates = computeRates(periodFunnel);
  const economics = overall.economics;

  const funnelData = [
    { stage: '声掛け', count: overall.counts.approaches },
    { stage: '立ち止まり', count: overall.counts.stops },
    { stage: 'QR読取', count: overall.counts.qr_scanned },
    { stage: '診断開始', count: overall.counts.diagnosis_started },
    { stage: '診断完了', count: overall.counts.diagnosis_completed },
    { stage: 'リード', count: overall.counts.lead_registered },
    { stage: '面談予約', count: overall.counts.interview_booked },
    { stage: '面談実施', count: overall.counts.interview_completed },
    { stage: '有望候補者', count: overall.counts.candidate_qualified },
    { stage: '送客', count: overall.counts.agent_referred },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ink-900">ダッシュボード</h1>
          <p className="text-xs text-ink-500">{period.label}に実施したシフトのコホート指標</p>
        </div>
        <PeriodFilter period={period} basePath="/admin" query={query} />
      </div>

      {overall.shiftCount === 0 && (
        <Alert tone="warning">この期間に実施されたシフトがありません。期間を変更してください。</Alert>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink-700">Acquisition</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
          <Stat label="Sales Hours" value={formatNumber(overall.counts.salesHours, 1)} />
          <Stat label="声掛け" value={formatNumber(overall.counts.approaches)} />
          <Stat label="立ち止まり" value={formatNumber(overall.counts.stops)} />
          <Stat label={labelOf(EVENT_LABELS, 'qr_scanned')} value={formatNumber(overall.counts.qr_scanned)} />
          <Stat label="診断開始" value={formatNumber(overall.counts.diagnosis_started)} />
          <Stat label="診断完了" value={formatNumber(overall.counts.diagnosis_completed)} />
          <Stat label="リード" value={formatNumber(overall.counts.lead_registered)} tone="brand" />
          <Stat label="面談予約" value={formatNumber(overall.counts.interview_booked)} />
          <Stat label="面談実施" value={formatNumber(overall.counts.interview_completed)} />
          <Stat label="有望候補者" value={formatNumber(overall.counts.candidate_qualified)} />
          <Stat label="送客" value={formatNumber(overall.counts.agent_referred)} />
          <Stat label="入社" value={formatNumber(overall.counts.joined)} tone="positive" />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink-700">Financial</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Estimated Revenue" value={formatYen(economics.estimatedRevenue)} />
          <Stat label="Confirmed Revenue" value={formatYen(economics.confirmedRevenue)} tone="brand" />
          <Stat label="営業インセンティブ" value={formatYen(economics.salesIncentives)} />
          <Stat label="その他獲得コスト" value={formatYen(economics.otherAcquisitionCost + economics.baseWageCost)} />
          <Stat
            label="Contribution Margin"
            value={formatYen(economics.contributionMargin)}
            tone={economics.contributionMargin >= 0 ? 'positive' : 'negative'}
          />
          <Stat label="Revenue / Sales Hour" value={formatYen(economics.revenuePerSalesHour)} />
          <Stat
            label="Gross Profit / Sales Hour"
            value={formatYen(economics.grossProfitPerSalesHour)}
            tone={economics.grossProfitPerSalesHour >= 0 ? 'positive' : 'negative'}
            sub="最重要指標"
          />
          <Stat label="Cost / Qualified" value={formatYen(economics.costPerQualified)} />
          <Stat label="Cost / Lead" value={formatYen(economics.costPerLead)} />
          <Stat label="Cost / Diagnosis" value={formatYen(economics.costPerDiagnosis)} />
          <Stat label="Revenue / Lead" value={formatYen(economics.revenuePerLead)} />
          <Stat label="Revenue / Referral" value={formatYen(economics.revenuePerReferral)} />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="獲得ファネル" description="この期間のシフトで獲得した候補者の到達段階">
          <FunnelChart data={funnelData} />
        </Card>

        <Card title="Conversion Rate" description="コホート基準（左）と期間内イベント基準（右）">
          <dl className="divide-y divide-slate-100">
            {[
              ['Stop Rate', overall.rates.stopRate, periodRates.stopRate],
              ['QR Rate', overall.rates.scanRate, periodRates.scanRate],
              ['診断完了率', overall.rates.diagnosisCompletionRate, periodRates.diagnosisCompletionRate],
              ['登録率', overall.rates.registrationRate, periodRates.registrationRate],
              ['面談予約率', overall.rates.interviewBookingRate, periodRates.interviewBookingRate],
              ['面談着座率', overall.rates.interviewAttendanceRate, periodRates.interviewAttendanceRate],
              ['有望率', overall.rates.qualifiedRate, periodRates.qualifiedRate],
              ['送客率', overall.rates.referralRate, periodRates.referralRate],
            ].map(([label, cohort, periodValue]) => (
              <div key={String(label)} className="flex items-center justify-between gap-4 py-2 text-sm">
                <dt className="text-ink-700">{label}</dt>
                <dd className="tabular flex gap-4">
                  <span className="font-semibold text-ink-900">{formatPercent(Number(cohort))}</span>
                  <span className="w-16 text-right text-ink-500">{formatPercent(Number(periodValue))}</span>
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </div>
  );
}
