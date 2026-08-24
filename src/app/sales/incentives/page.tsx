import { and, desc, eq, gte, lte } from "drizzle-orm";
import { endOfMonth, startOfMonth, subMonths } from "date-fns";
import { getDb } from "@/lib/db";
import { incentiveLedger, incentiveRules, locations, shifts } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guards";
import { getIncentiveTotals } from "@/lib/domain/incentive/service";
import {
  Badge,
  EmptyState,
  NumTd,
  PageHeader,
  StatTile,
  TableWrap,
  Td,
  Th,
} from "@/components/ui";
import {
  INCENTIVE_EVENT_LABELS,
  INCENTIVE_STATUS_LABELS,
  labelOf,
} from "@/lib/utils/labels";
import { formatYen } from "@/lib/utils/format";

const STATUS_TONE = {
  pending: "caution",
  approved: "positive",
  rejected: "negative",
  paid: "brand",
} as const;

export default async function IncentivesPage() {
  const user = await requireRole("sales", "admin");
  const db = await getDb();

  const now = new Date();
  const from = startOfMonth(subMonths(now, 2));
  const to = endOfMonth(now);

  const [totals, entries] = await Promise.all([
    getIncentiveTotals(db, user.id, startOfMonth(now), endOfMonth(now)),
    db
      .select({
        id: incentiveLedger.id,
        eventType: incentiveLedger.eventType,
        amountYen: incentiveLedger.amountYen,
        occurredAt: incentiveLedger.occurredAt,
        status: incentiveLedger.status,
        ruleName: incentiveRules.name,
        venueName: locations.venueName,
      })
      .from(incentiveLedger)
      .innerJoin(incentiveRules, eq(incentiveLedger.ruleId, incentiveRules.id))
      .leftJoin(shifts, eq(incentiveLedger.shiftId, shifts.id))
      .leftJoin(locations, eq(shifts.locationId, locations.id))
      .where(
        and(
          eq(incentiveLedger.salesUserId, user.id),
          gte(incentiveLedger.occurredAt, from),
          lte(incentiveLedger.occurredAt, to),
        ),
      )
      .orderBy(desc(incentiveLedger.occurredAt))
      .limit(200),
  ]);

  return (
    <>
      <PageHeader
        title="報酬明細"
        description="同じ候補者の同じ成果は二重に計上されません。"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="今月合計" value={formatYen(totals.totalYen)} tone="positive" />
        <StatTile label="承認待ち" value={formatYen(totals.pendingYen)} />
        <StatTile label="承認済み" value={formatYen(totals.approvedYen)} />
        <StatTile label="支払済み" value={formatYen(totals.paidYen)} />
      </div>

      <div className="mt-6">
        {entries.length === 0 ? (
          <EmptyState
            title="対象期間の報酬明細はありません"
            description="診断完了・リード登録などの成果が発生すると自動で記録されます。"
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>発生日</Th>
                <Th>成果</Th>
                <Th>営業場所</Th>
                <Th className="text-right">金額</Th>
                <Th>状態</Th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <Td className="text-ink-500">
                    {entry.occurredAt.toLocaleDateString("ja-JP", {
                      month: "numeric",
                      day: "numeric",
                    })}
                  </Td>
                  <Td className="font-medium">
                    {labelOf(INCENTIVE_EVENT_LABELS, entry.eventType)}
                  </Td>
                  <Td className="text-ink-500">{entry.venueName ?? "—"}</Td>
                  <NumTd className="font-semibold">{formatYen(entry.amountYen)}</NumTd>
                  <Td>
                    <Badge tone={STATUS_TONE[entry.status]}>
                      {labelOf(INCENTIVE_STATUS_LABELS, entry.status)}
                    </Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </div>
    </>
  );
}
