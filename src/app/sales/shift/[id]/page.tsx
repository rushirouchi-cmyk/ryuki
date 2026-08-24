import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import QRCode from "qrcode";
import { getDb } from "@/lib/db";
import { locations, qrCodes, shifts } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guards";
import { getShiftMetrics } from "@/lib/analytics/shift";
import { Card, CardTitle, PageHeader, StatTile } from "@/components/ui";
import { VENUE_TYPE_LABELS, WEATHER_LABELS, labelOf } from "@/lib/utils/labels";
import { formatNumber, formatYen } from "@/lib/utils/format";
import { CounterPad } from "./counter-pad";
import { EndShiftButton } from "./end-shift";

export default async function ShiftDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("sales", "admin");
  const { id } = await params;
  const shiftId = Number(id);
  if (!Number.isInteger(shiftId)) notFound();

  const db = await getDb();
  const [row] = await db
    .select({ shift: shifts, location: locations })
    .from(shifts)
    .innerJoin(locations, eq(shifts.locationId, locations.id))
    .where(eq(shifts.id, shiftId))
    .limit(1);
  if (!row) notFound();

  /* A sales rep only ever sees their own shift; admins may view any. */
  if (user.role !== "admin" && row.shift.salesUserId !== user.id) notFound();

  const [qr] = await db
    .select({ token: qrCodes.token, active: qrCodes.active })
    .from(qrCodes)
    .where(eq(qrCodes.shiftId, shiftId))
    .orderBy(desc(qrCodes.createdAt))
    .limit(1);

  const metrics = (await getShiftMetrics(db, [shiftId])).get(shiftId);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const scanUrl = qr ? `${baseUrl}/d/${qr.token}` : null;
  const qrSvg = scanUrl
    ? await QRCode.toString(scanUrl, { type: "svg", margin: 1, width: 220 })
    : null;

  const isActive = row.shift.status === "active";

  return (
    <>
      <PageHeader
        title={row.location.venueName}
        description={`${row.location.prefecture}${row.location.city}・${labelOf(
          VENUE_TYPE_LABELS,
          row.location.venueType,
        )}・${labelOf(WEATHER_LABELS, row.shift.weather)}`}
        actions={isActive ? <EndShiftButton shiftId={shiftId} /> : undefined}
      />

      {isActive ? (
        <CounterPad
          shiftId={shiftId}
          approachCount={row.shift.approachCount}
          stoppedCount={row.shift.stoppedCount}
        />
      ) : (
        <Card className="mb-5">
          <p className="text-sm text-ink-600">
            この営業シフトは終了しています（
            {row.shift.endTime?.toLocaleString("ja-JP") ?? "—"}）。
          </p>
        </Card>
      )}

      {qrSvg && scanUrl ? (
        <Card className="mb-5">
          <CardTitle>この営業専用のQRコード</CardTitle>
          <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row sm:items-center">
            <div
              className="shrink-0 rounded-xl bg-white p-2 [&>svg]:h-44 [&>svg]:w-44"
              // QR is generated server-side from an internal URL; no user input.
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
            <div className="min-w-0 text-center sm:text-left">
              <p className="text-sm text-ink-600">
                このQRから流入した候補者は、あなた・この場所・このシフトに自動で紐づきます。
              </p>
              <p className="mt-2 break-all rounded-lg bg-ink-100 px-2 py-1.5 text-xs text-ink-700">
                {scanUrl}
              </p>
              {!qr?.active ? (
                <p className="mt-2 text-xs text-caution">
                  シフト終了により、このQRは無効化されています。
                </p>
              ) : null}
            </div>
          </div>
        </Card>
      ) : null}

      <CardTitle>このシフトの成果</CardTitle>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="QR読取" value={formatNumber(metrics?.scanCount ?? 0)} />
        <StatTile label="診断開始" value={formatNumber(metrics?.diagnosisStarted ?? 0)} />
        <StatTile label="診断完了" value={formatNumber(metrics?.diagnosisCompleted ?? 0)} />
        <StatTile
          label="有効リード"
          value={formatNumber(metrics?.leadRegistered ?? 0)}
          tone="brand"
        />
        <StatTile label="面談予約" value={formatNumber(metrics?.interviewBooked ?? 0)} />
        <StatTile label="面談実施" value={formatNumber(metrics?.interviewCompleted ?? 0)} />
        <StatTile label="有効候補者" value={formatNumber(metrics?.qualifiedCount ?? 0)} />
        <StatTile label="送客" value={formatNumber(metrics?.referralCount ?? 0)} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <StatTile
          label="このシフトの報酬"
          value={formatYen(metrics?.incentiveYen ?? 0)}
          tone="positive"
        />
        <StatTile
          label="稼働時間"
          value={`${(metrics?.salesHours ?? 0).toFixed(1)}h`}
          hint={`声掛け ${formatNumber(row.shift.approachCount)}件`}
        />
      </div>
    </>
  );
}
