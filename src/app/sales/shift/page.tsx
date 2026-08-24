import { eq } from 'drizzle-orm';
import QRCode from 'qrcode';
import Image from 'next/image';
import { getDb, schema } from '@/db/client';
import { Alert, Card, Stat } from '@/components/ui';
import { Button } from '@/components/ui/forms';
import { requireSales } from '@/server/guards';
import { getActiveShift, getShiftEvents, shiftHours } from '@/server/services/shifts';
import { countFunnel } from '@/domain/analytics/funnel';
import { formatDateTime, formatNumber, labelOf, VENUE_TYPE_LABELS, WEATHER_LABELS } from '@/lib/format';
import { closeShiftAction } from '../actions';
import { ShiftForm } from './shift-form';

export const dynamic = 'force-dynamic';

export default async function SalesShiftPage() {
  const user = await requireSales();
  const shift = await getActiveShift(user.userId);

  if (!shift) {
    const locations = await getDb().query.locations.findMany({
      where: eq(schema.locations.active, true),
    });
    return (
      <div className="space-y-5">
        <h1 className="text-lg font-bold text-ink-900">営業を開始する</h1>
        <Card>
          <ShiftForm
            locations={locations.map((location) => ({
              id: location.id,
              label: `${location.venueName}（${location.prefecture}${location.city}）`,
              venueType: location.venueType,
            }))}
          />
        </Card>
      </div>
    );
  }

  const qr = shift.qrCodes.find((code) => code.active) ?? shift.qrCodes[0];
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const scanUrl = qr ? `${baseUrl}/d/${qr.token}` : null;
  const qrDataUrl = scanUrl
    ? await QRCode.toDataURL(scanUrl, { width: 512, margin: 1, errorCorrectionLevel: 'M' })
    : null;

  const events = await getShiftEvents(shift.id);
  const funnel = countFunnel(events);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink-900">{shift.location.venueName}</h1>
        <p className="text-xs text-ink-500">
          {labelOf(VENUE_TYPE_LABELS, shift.venueType)} ・ {labelOf(WEATHER_LABELS, shift.weather)} ・{' '}
          {formatDateTime(shift.startTime)} 開始（{formatNumber(shiftHours(shift), 1)}時間）
        </p>
      </div>

      <Card title="診断用QRコード" description="このQRは営業担当 × 場所 × シフト単位で発行されています">
        {qrDataUrl && scanUrl ? (
          <div className="flex flex-col items-center">
            <Image
              src={qrDataUrl}
              alt="診断ページのQRコード"
              width={256}
              height={256}
              unoptimized
              className="h-64 w-64 rounded-xl border border-slate-200"
            />
            <p className="mt-3 break-all text-center text-[11px] text-ink-500">{scanUrl}</p>
          </div>
        ) : (
          <Alert tone="warning">QRコードが発行されていません。</Alert>
        )}
      </Card>

      <Card title="このシフトの成果" description="QR読取以降は自動集計されます">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="声掛け" value={formatNumber(shift.approachCount)} />
          <Stat label="立ち止まり" value={formatNumber(shift.stoppedCount)} />
          <Stat label="QR読取" value={formatNumber(funnel.qr_scanned)} />
          <Stat label="診断完了" value={formatNumber(funnel.diagnosis_completed)} />
          <Stat label="有効リード" value={formatNumber(funnel.lead_registered)} tone="brand" />
          <Stat label="面談予約" value={formatNumber(funnel.interview_booked)} />
        </div>
      </Card>

      <form action={closeShiftAction}>
        <input type="hidden" name="shiftId" value={shift.id} />
        <Button type="submit" variant="secondary" size="lg">
          営業を終了する
        </Button>
      </form>
    </div>
  );
}
