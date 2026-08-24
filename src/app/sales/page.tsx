import Link from 'next/link';
import { Alert, Card, EmptyState, Stat } from '@/components/ui';
import { requireSales } from '@/server/guards';
import { loadSalesDashboard } from '@/server/services/sales-dashboard';
import { EVENT_LABELS, formatNumber, formatYen, labelOf } from '@/lib/format';
import { CounterPad } from './counter-pad';

export const dynamic = 'force-dynamic';

export default async function SalesDashboardPage() {
  const user = await requireSales();
  const data = await loadSalesDashboard(user.userId);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink-900">本日の実績</h1>
        <p className="text-xs text-ink-500">
          稼働 {formatNumber(data.today.salesHours, 1)} 時間
        </p>
      </div>

      {data.activeShift ? (
        <CounterPad
          shiftId={data.activeShift.id}
          venueName={data.activeShift.location.venueName}
          approachCount={data.activeShift.approachCount}
          stoppedCount={data.activeShift.stoppedCount}
        />
      ) : (
        <Card>
          <EmptyState title="稼働中のシフトがありません" description="シフトを開始するとQRコードが発行されます。" />
          <Link
            href="/sales/shift"
            className="mt-4 block rounded-xl bg-brand-600 px-5 py-4 text-center text-base font-semibold text-white"
          >
            営業を開始する
          </Link>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Stat label={labelOf(EVENT_LABELS, 'qr_scanned')} value={formatNumber(data.today.scans)} />
        <Stat label={labelOf(EVENT_LABELS, 'diagnosis_completed')} value={formatNumber(data.today.diagnosisCompleted)} />
        <Stat label="有効リード" value={formatNumber(data.today.leads)} tone="brand" />
        <Stat label={labelOf(EVENT_LABELS, 'interview_booked')} value={formatNumber(data.today.interviewBooked)} />
        <Stat label={labelOf(EVENT_LABELS, 'interview_completed')} value={formatNumber(data.today.interviewCompleted)} />
        <Stat label={labelOf(EVENT_LABELS, 'agent_referred')} value={formatNumber(data.today.referrals)} />
      </div>

      <Card title="報酬" description="確定前の暫定額を含みます">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="本日の暫定報酬" value={formatYen(data.todayIncentive)} tone="brand" />
          <Stat label="今月累計" value={formatYen(data.monthIncentive)} />
        </div>
        {data.pendingIncentive > 0 && (
          <p className="mt-3 text-xs text-ink-500">
            うち承認待ち {formatYen(data.pendingIncentive)}
          </p>
        )}
        {data.bonus && (
          <div className="mt-4">
            <Alert tone="info">
              あと <strong className="font-bold">{data.bonus.remaining}件</strong>{' '}
              {labelOf(EVENT_LABELS, data.bonus.label)} でボーナス条件達成（
              {formatYen(data.bonus.bonusAmount)}）
            </Alert>
          </div>
        )}
        <Link href="/sales/incentives" className="mt-4 block text-center text-xs text-brand-600 underline">
          報酬明細を見る
        </Link>
      </Card>
    </div>
  );
}
