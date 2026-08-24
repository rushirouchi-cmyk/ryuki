import Link from "next/link";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { endOfDay, endOfMonth, startOfDay, startOfMonth } from "date-fns";
import { getDb } from "@/lib/db";
import { locations, shifts } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guards";
import { getSalesDaySummary } from "@/lib/analytics/shift";
import { getIncentiveTotals } from "@/lib/domain/incentive/service";
import { Card, CardTitle, EmptyState, LinkButton, PageHeader, StatTile } from "@/components/ui";
import { formatNumber, formatYen } from "@/lib/utils/format";
import { NextMilestone } from "./milestone";

export default async function SalesHomePage() {
  const user = await requireRole("sales", "admin");
  const db = await getDb();

  const now = new Date();
  const [today, month] = await Promise.all([
    getSalesDaySummary(db, user.id, startOfDay(now), endOfDay(now)),
    getIncentiveTotals(db, user.id, startOfMonth(now), endOfMonth(now)),
  ]);

  const [activeShift] = await db
    .select({
      id: shifts.id,
      venueName: locations.venueName,
      startTime: shifts.startTime,
    })
    .from(shifts)
    .innerJoin(locations, eq(shifts.locationId, locations.id))
    .where(and(eq(shifts.salesUserId, user.id), eq(shifts.status, "active")))
    .orderBy(desc(shifts.startTime))
    .limit(1);

  const recentShifts = await db
    .select({
      id: shifts.id,
      venueName: locations.venueName,
      startTime: shifts.startTime,
      status: shifts.status,
    })
    .from(shifts)
    .innerJoin(locations, eq(shifts.locationId, locations.id))
    .where(
      and(
        eq(shifts.salesUserId, user.id),
        gte(shifts.startTime, new Date(now.getTime() - 14 * 86_400_000)),
        lte(shifts.startTime, endOfDay(now)),
      ),
    )
    .orderBy(desc(shifts.startTime))
    .limit(8);

  const t = today.totals;

  return (
    <>
      <PageHeader title="本日の実績" description={now.toLocaleDateString("ja-JP")} />

      {activeShift ? (
        <Link href={`/sales/shift/${activeShift.id}`} className="block">
          <Card className="mb-5 border-brand-300 bg-brand-50">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-brand-600">営業中</p>
                <p className="truncate font-bold text-ink-900">{activeShift.venueName}</p>
                <p className="text-xs text-ink-500">
                  {activeShift.startTime.toLocaleTimeString("ja-JP", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  開始
                </p>
              </div>
              <span className="shrink-0 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white">
                カウンターを開く
              </span>
            </div>
          </Card>
        </Link>
      ) : (
        <Card className="mb-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-ink-600">現在、稼働中の営業シフトはありません。</p>
            <LinkButton href="/sales/shift/new" className="shrink-0">
              営業を開始
            </LinkButton>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="声掛け" value={formatNumber(t.approachCount)} />
        <StatTile label="立ち止まり" value={formatNumber(t.stoppedCount)} />
        <StatTile label="QR読取" value={formatNumber(t.scanCount)} />
        <StatTile label="診断完了" value={formatNumber(t.diagnosisCompleted)} />
        <StatTile label="有効リード" value={formatNumber(t.leadRegistered)} tone="brand" />
        <StatTile label="面談予約" value={formatNumber(t.interviewBooked)} />
        <StatTile label="面談実施" value={formatNumber(t.interviewCompleted)} />
        <StatTile label="送客" value={formatNumber(t.referralCount)} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <StatTile
          label="本日の暫定報酬"
          value={formatYen(t.incentiveYen)}
          hint="承認前の見込み額を含みます"
          tone="positive"
        />
        <StatTile
          label="今月累計"
          value={formatYen(month.totalYen)}
          hint={`承認待ち ${formatYen(month.pendingYen)}`}
        />
      </div>

      <div className="mt-5">
        <NextMilestone
          interviewCompleted={t.interviewCompleted}
          leadRegistered={t.leadRegistered}
        />
      </div>

      <section className="mt-8">
        <CardTitle>最近の営業シフト</CardTitle>
        <div className="mt-2 space-y-2">
          {recentShifts.length === 0 ? (
            <EmptyState
              title="まだ営業シフトがありません"
              description="「営業開始」から最初のシフトを作成してください。"
            />
          ) : (
            recentShifts.map((shift) => (
              <Link key={shift.id} href={`/sales/shift/${shift.id}`} className="block">
                <Card className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-800">
                      {shift.venueName}
                    </p>
                    <p className="text-xs text-ink-500">
                      {shift.startTime.toLocaleString("ja-JP", {
                        month: "numeric",
                        day: "numeric",
                        weekday: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-ink-400">
                    {shift.status === "active" ? "営業中" : "終了"}
                  </span>
                </Card>
              </Link>
            ))
          )}
        </div>
      </section>
    </>
  );
}
