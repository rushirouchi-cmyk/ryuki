import { Badge, Table, Td, Th } from '@/components/ui';
import type { Segment } from '@/server/services/analytics';
import { formatNumber, formatPercent, formatYen } from '@/lib/format';

/**
 * Shared comparison table for area / sales rep / venue type / time band views.
 * Sample size is always visible so a promising n=7 row cannot be mistaken for a
 * proven one.
 */
export function SegmentTable({
  segments,
  firstColumnLabel,
  showAreaScore = true,
}: {
  segments: Segment[];
  firstColumnLabel: string;
  showAreaScore?: boolean;
}) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>{firstColumnLabel}</Th>
          <Th align="right">稼働h</Th>
          <Th align="right">声掛け</Th>
          <Th align="right">立止り率</Th>
          <Th align="right">QR</Th>
          <Th align="right">診断完了</Th>
          <Th align="right">リード</Th>
          <Th align="right">面談実施</Th>
          <Th align="right">有望</Th>
          <Th align="right">送客</Th>
          <Th align="right">売上/h</Th>
          <Th align="right">粗利/h</Th>
          {showAreaScore && <Th align="center">Area Score</Th>}
        </tr>
      </thead>
      <tbody>
        {segments.map((segment) => (
          <tr key={segment.key} className="hover:bg-slate-50">
            <Td>
              <span className="font-medium text-ink-900">{segment.label}</span>
              {segment.sublabel && <span className="ml-2 text-xs text-ink-500">{segment.sublabel}</span>}
            </Td>
            <Td align="right">{formatNumber(segment.counts.salesHours, 1)}</Td>
            <Td align="right">{formatNumber(segment.counts.approaches)}</Td>
            <Td align="right">{formatPercent(segment.rates.stopRate)}</Td>
            <Td align="right">{formatNumber(segment.counts.qr_scanned)}</Td>
            <Td align="right">{formatNumber(segment.counts.diagnosis_completed)}</Td>
            <Td align="right">{formatNumber(segment.counts.lead_registered)}</Td>
            <Td align="right">{formatNumber(segment.counts.interview_completed)}</Td>
            <Td align="right">{formatNumber(segment.counts.candidate_qualified)}</Td>
            <Td align="right">{formatNumber(segment.counts.agent_referred)}</Td>
            <Td align="right">{formatYen(segment.economics.revenuePerSalesHour)}</Td>
            <Td
              align="right"
              className={
                segment.economics.grossProfitPerSalesHour >= 0
                  ? 'font-semibold text-emerald-600'
                  : 'font-semibold text-rose-600'
              }
            >
              {formatYen(segment.economics.grossProfitPerSalesHour)}
            </Td>
            {showAreaScore && (
              <Td align="center">
                <span className="inline-flex items-center gap-1.5">
                  <Badge
                    tone={
                      segment.areaScore.rank === 'S'
                        ? 'success'
                        : segment.areaScore.rank === 'A'
                          ? 'brand'
                          : 'neutral'
                    }
                  >
                    {segment.areaScore.rank} {segment.areaScore.score}
                  </Badge>
                  {segment.areaScore.lowConfidence && (
                    <span
                      title="サンプル数が少ないため参考値です"
                      className="text-[10px] whitespace-nowrap text-amber-600"
                    >
                      n={formatNumber(segment.areaScore.sampleApproaches)}
                    </span>
                  )}
                </span>
              </Td>
            )}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
