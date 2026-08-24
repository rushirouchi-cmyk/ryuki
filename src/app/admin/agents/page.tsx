import { getDb } from "@/lib/db";
import { resolvePeriod } from "@/lib/analytics/period";
import {
  getAgentOccupationPerformance,
  getAgentPerformance,
} from "@/lib/analytics/agents";
import {
  CardTitle,
  EmptyState,
  NumTd,
  PageHeader,
  TableWrap,
  Td,
  Th,
} from "@/components/ui";
import { PeriodTabs } from "@/components/analytics/period-tabs";
import { formatManYen, formatNumber, formatPercent, formatYen } from "@/lib/utils/format";

export default async function AdminAgentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const period = resolvePeriod(params);
  const db = await getDb();

  const [rows, byOccupation] = await Promise.all([
    getAgentPerformance(db, period.from, period.to),
    getAgentOccupationPerformance(db),
  ]);

  return (
    <>
      <PageHeader
        title="エージェント分析"
        description={`${period.label}｜送客先ごとの決定率と売上`}
        actions={<PeriodTabs active={period.key} />}
      />

      {rows.length === 0 ? (
        <EmptyState title="エージェントが登録されていません" />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>エージェント</Th>
              <Th className="text-right">送客</Th>
              <Th className="text-right">受諾</Th>
              <Th className="text-right">面談実施</Th>
              <Th className="text-right">応募</Th>
              <Th className="text-right">内定</Th>
              <Th className="text-right">入社</Th>
              <Th className="text-right">受諾率</Th>
              <Th className="text-right">内定率</Th>
              <Th className="text-right">入社率</Th>
              <Th className="text-right">平均提示年収</Th>
              <Th className="text-right">平均年収上昇</Th>
              <Th className="text-right">確定売上</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.agentCompanyId}>
                <Td className="font-medium text-ink-900">{row.name}</Td>
                <NumTd>{formatNumber(row.referrals)}</NumTd>
                <NumTd>{formatNumber(row.accepted)}</NumTd>
                <NumTd>{formatNumber(row.interviewCompleted)}</NumTd>
                <NumTd>{formatNumber(row.applied)}</NumTd>
                <NumTd>{formatNumber(row.offers)}</NumTd>
                <NumTd className="font-semibold">{formatNumber(row.joined)}</NumTd>
                <NumTd>{formatPercent(row.acceptRate)}</NumTd>
                <NumTd>{formatPercent(row.offerRate)}</NumTd>
                <NumTd>{formatPercent(row.joinRate)}</NumTd>
                <NumTd>{formatManYen(row.avgOfferSalaryYen)}</NumTd>
                <NumTd
                  className={
                    (row.avgSalaryIncreaseYen ?? 0) > 0 ? "text-positive" : undefined
                  }
                >
                  {formatManYen(row.avgSalaryIncreaseYen)}
                </NumTd>
                <NumTd>{formatYen(row.confirmedRevenueYen)}</NumTd>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}

      <section className="mt-8">
        <CardTitle>職種別パフォーマンス（全期間）</CardTitle>
        <p className="mt-1 text-xs text-ink-500">
          将来の Candidate × Agent 自動ルーティングの学習対象になるデータです。
        </p>
        <div className="mt-2">
          {byOccupation.length === 0 ? (
            <EmptyState title="送客実績がまだありません" />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>エージェント</Th>
                  <Th>候補者の現職</Th>
                  <Th className="text-right">送客</Th>
                  <Th className="text-right">入社</Th>
                  <Th className="text-right">入社率</Th>
                </tr>
              </thead>
              <tbody>
                {byOccupation.map((row) => (
                  <tr key={`${row.agentCompanyId}-${row.occupationName}`}>
                    <Td>{row.agentName}</Td>
                    <Td className="font-medium">{row.occupationName}</Td>
                    <NumTd>{formatNumber(row.referrals)}</NumTd>
                    <NumTd>{formatNumber(row.joined)}</NumTd>
                    <NumTd>{formatPercent(row.joinRate)}</NumTd>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </div>
      </section>
    </>
  );
}
