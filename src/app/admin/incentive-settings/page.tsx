import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  agentCompanies,
  incentiveLedger,
  incentiveRules,
  referrals,
  revenueEvents,
  users,
} from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guards";
import {
  Badge,
  Card,
  CardTitle,
  EmptyState,
  NumTd,
  PageHeader,
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
import { RuleForm } from "./rule-form";
import { LedgerActions, RevenueActions } from "./ledger-actions";

const STATUS_TONE = {
  pending: "caution",
  approved: "positive",
  rejected: "negative",
  paid: "brand",
} as const;

export default async function IncentiveSettingsPage() {
  await requireRole("admin");
  const db = await getDb();

  const [rules, pendingLedger, pendingRevenue] = await Promise.all([
    db.select().from(incentiveRules).orderBy(incentiveRules.eventType),
    db
      .select({
        id: incentiveLedger.id,
        salesName: users.name,
        eventType: incentiveLedger.eventType,
        amountYen: incentiveLedger.amountYen,
        occurredAt: incentiveLedger.occurredAt,
        status: incentiveLedger.status,
      })
      .from(incentiveLedger)
      .innerJoin(users, eq(incentiveLedger.salesUserId, users.id))
      .where(eq(incentiveLedger.status, "pending"))
      .orderBy(desc(incentiveLedger.occurredAt))
      .limit(100),
    db
      .select({
        id: revenueEvents.id,
        agentName: agentCompanies.name,
        eventType: revenueEvents.eventType,
        amountYen: revenueEvents.amountYen,
        occurredAt: revenueEvents.occurredAt,
        referralId: referrals.id,
      })
      .from(revenueEvents)
      .innerJoin(agentCompanies, eq(revenueEvents.agentCompanyId, agentCompanies.id))
      .innerJoin(referrals, eq(revenueEvents.referralId, referrals.id))
      .where(eq(revenueEvents.status, "estimated"))
      .orderBy(desc(revenueEvents.occurredAt))
      .limit(100),
  ]);

  return (
    <>
      <PageHeader
        title="報酬・売上設定"
        description="インセンティブのルールはコードではなくここで管理します。QR読取そのものには報酬を設定しません。"
      />

      <section className="mb-8">
        <CardTitle>インセンティブルール</CardTitle>
        <div className="mt-2">
          <TableWrap>
            <thead>
              <tr>
                <Th>名称</Th>
                <Th>対象イベント</Th>
                <Th className="text-right">金額</Th>
                <Th>適用期間</Th>
                <Th className="text-right">優先度</Th>
                <Th>条件</Th>
                <Th>状態</Th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id}>
                  <Td className="font-medium">{rule.name}</Td>
                  <Td>{labelOf(INCENTIVE_EVENT_LABELS, rule.eventType)}</Td>
                  <NumTd>{formatYen(rule.amountYen)}</NumTd>
                  <Td className="text-ink-500">
                    {rule.validFrom} 〜 {rule.validTo ?? "無期限"}
                  </Td>
                  <NumTd>{rule.priority}</NumTd>
                  <Td className="text-xs text-ink-500">
                    {rule.conditions ? JSON.stringify(rule.conditions) : "—"}
                  </Td>
                  <Td>
                    <Badge tone={rule.active ? "positive" : "neutral"}>
                      {rule.active ? "有効" : "無効"}
                    </Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </div>
        <div className="mt-4">
          <RuleForm />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <CardTitle>承認待ちのインセンティブ</CardTitle>
          <div className="mt-2">
            {pendingLedger.length === 0 ? (
              <EmptyState title="承認待ちの明細はありません" />
            ) : (
              <form>
                <TableWrap>
                  <thead>
                    <tr>
                      <Th />
                      <Th>営業担当</Th>
                      <Th>成果</Th>
                      <Th className="text-right">金額</Th>
                      <Th>発生日</Th>
                      <Th>状態</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingLedger.map((entry) => (
                      <tr key={entry.id}>
                        <Td>
                          <input
                            type="checkbox"
                            name="ledgerId"
                            value={entry.id}
                            className="h-4 w-4"
                            aria-label={`明細 ${entry.id} を選択`}
                          />
                        </Td>
                        <Td>{entry.salesName}</Td>
                        <Td>{labelOf(INCENTIVE_EVENT_LABELS, entry.eventType)}</Td>
                        <NumTd>{formatYen(entry.amountYen)}</NumTd>
                        <Td className="text-ink-500">
                          {entry.occurredAt.toLocaleDateString("ja-JP")}
                        </Td>
                        <Td>
                          <Badge tone={STATUS_TONE[entry.status]}>
                            {labelOf(INCENTIVE_STATUS_LABELS, entry.status)}
                          </Badge>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrap>
                <LedgerActions />
              </form>
            )}
          </div>
        </section>

        <section>
          <CardTitle>未確定の売上</CardTitle>
          <p className="mt-1 text-xs text-ink-500">
            エージェントからの入金確認後に「確定」にすると、粗利計算へ反映されます。
          </p>
          <div className="mt-2">
            {pendingRevenue.length === 0 ? (
              <EmptyState title="未確定の売上はありません" />
            ) : (
              <form>
                <TableWrap>
                  <thead>
                    <tr>
                      <Th />
                      <Th>エージェント</Th>
                      <Th>成果地点</Th>
                      <Th className="text-right">金額</Th>
                      <Th>発生日</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingRevenue.map((entry) => (
                      <tr key={entry.id}>
                        <Td>
                          <input
                            type="checkbox"
                            name="revenueEventId"
                            value={entry.id}
                            className="h-4 w-4"
                            aria-label={`売上 ${entry.id} を選択`}
                          />
                        </Td>
                        <Td>{entry.agentName}</Td>
                        <Td>{entry.eventType}</Td>
                        <NumTd>{formatYen(entry.amountYen)}</NumTd>
                        <Td className="text-ink-500">
                          {entry.occurredAt.toLocaleDateString("ja-JP")}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrap>
                <RevenueActions />
              </form>
            )}
          </div>
        </section>
      </div>

      <Card className="mt-8">
        <CardTitle>二重計上の防止について</CardTitle>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          インセンティブ明細は「候補者 × 成果イベント」の一意制約で保護されています。
          同じ候補者が複数のQRを読み取っても、また同じ成果が再送されても、
          報酬は一度しか計上されません。QR読取そのものは、質の低い獲得競争を防ぐため
          報酬対象から外しています。
        </p>
      </Card>
    </>
  );
}
