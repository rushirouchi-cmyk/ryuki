import { Badge, NumTd, TableWrap, Td, Th } from "@/components/ui";
import type { AreaScoreResult } from "@/lib/analytics/area-score";
import type { BreakdownRow } from "@/lib/analytics/types";
import { formatNumber, formatPercent, formatYen } from "@/lib/utils/format";

const RANK_TONE = {
  S: "brand",
  A: "positive",
  B: "caution",
  C: "neutral",
} as const;

/**
 * The comparison table the operator actually decides from. Gross profit per
 * sales hour is the anchor column, and the sample size sits next to the score
 * so a lucky n=7 location is never mistaken for a proven one.
 */
export function BreakdownTable({
  rows,
  scores,
  labelHeader = "エリア",
}: {
  rows: BreakdownRow[];
  scores?: Map<string, AreaScoreResult>;
  labelHeader?: string;
}) {
  return (
    <TableWrap>
      <thead>
        <tr>
          <Th>{labelHeader}</Th>
          {scores ? <Th>スコア</Th> : null}
          <Th className="text-right">営業時間</Th>
          <Th className="text-right">声掛け</Th>
          <Th className="text-right">立ち止まり率</Th>
          <Th className="text-right">QR</Th>
          <Th className="text-right">診断完了</Th>
          <Th className="text-right">リード</Th>
          <Th className="text-right">面談実施</Th>
          <Th className="text-right">有効候補者</Th>
          <Th className="text-right">送客</Th>
          <Th className="text-right">確定売上</Th>
          <Th className="text-right">売上/h</Th>
          <Th className="text-right">粗利/h</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const score = scores?.get(row.key);
          const gpPerHour = row.economics.grossProfitPerSalesHour;
          return (
            <tr key={row.key}>
              <Td>
                <span className="font-medium text-ink-900">{row.label}</span>
                {row.sublabel ? (
                  <span className="ml-2 text-xs text-ink-400">{row.sublabel}</span>
                ) : null}
              </Td>
              {scores ? (
                <Td>
                  {score ? (
                    <span className="flex items-center gap-2">
                      <Badge tone={RANK_TONE[score.rank]}>{score.rank}</Badge>
                      <span className="tabular text-xs text-ink-500">{score.score}</span>
                      {!score.sufficientData ? (
                        <span
                          className="text-xs text-caution"
                          title="サンプル数が判断に十分ではありません"
                        >
                          参考値
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    "—"
                  )}
                </Td>
              ) : null}
              <NumTd>{row.funnel.salesHours.toFixed(1)}h</NumTd>
              <NumTd>{formatNumber(row.funnel.approaches)}</NumTd>
              <NumTd>{formatPercent(row.rates.stopRate)}</NumTd>
              <NumTd>{formatNumber(row.funnel.scans)}</NumTd>
              <NumTd>{formatNumber(row.funnel.diagnosisCompleted)}</NumTd>
              <NumTd className="font-semibold">{formatNumber(row.funnel.leads)}</NumTd>
              <NumTd>{formatNumber(row.funnel.interviewCompleted)}</NumTd>
              <NumTd>{formatNumber(row.funnel.qualified)}</NumTd>
              <NumTd>{formatNumber(row.funnel.referrals)}</NumTd>
              <NumTd>{formatYen(row.financials.confirmedRevenueYen)}</NumTd>
              <NumTd>{formatYen(row.economics.revenuePerSalesHour)}</NumTd>
              <NumTd
                className={
                  gpPerHour === null
                    ? ""
                    : gpPerHour >= 0
                      ? "font-semibold text-positive"
                      : "font-semibold text-negative"
                }
              >
                {formatYen(gpPerHour)}
              </NumTd>
            </tr>
          );
        })}
      </tbody>
    </TableWrap>
  );
}
