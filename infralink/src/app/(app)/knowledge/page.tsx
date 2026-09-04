import { requireUser } from '@/lib/auth';
import { Forbidden } from '@/components/forbidden';
import { can } from '@/lib/rbac';
import { breakdownBy, careerChangePatterns, rejectionTagStats } from '@/lib/domain/knowledge';
import { Card, Cell, Empty, PageHeader, Row, Table } from '@/components/ui';
import { REJECTION_TAG_LABELS, type RejectionTag } from '@/lib/domain/enums';

export const dynamic = 'force-dynamic';

const AXES = [
  { key: 'jobCategory', label: '職種別' },
  { key: 'industry', label: '業界別' },
  { key: 'ageBand', label: '年齢別' },
  { key: 'qualification', label: '資格別' },
  { key: 'experienceBand', label: '経験年数別' },
  { key: 'company', label: '企業別' },
] as const;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** ナレッジ分析 (§33/§34/§35)。蓄積した選考結果を会社のナレッジとして見る。 */
export default async function KnowledgePage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  if (!can(user, 'report:read')) return <Forbidden needed="report:read" />;
  const params = await searchParams;
  const raw = Array.isArray(params.axis) ? params.axis[0] : params.axis;
  const axis = (AXES.find((a) => a.key === raw)?.key ?? 'jobCategory') as (typeof AXES)[number]['key'];

  const [rows, patterns, tags] = await Promise.all([
    breakdownBy(axis),
    careerChangePatterns(),
    rejectionTagStats(),
  ]);

  return (
    <>
      <PageHeader title="ナレッジ分析" description="蓄積した選考結果から、通過率と成功パターンを可視化します" />

      <div className="space-y-4 p-6">
        <Card
          title="軸別 通過率 (§33)"
          actions={
            <form method="get" className="flex items-center gap-1">
              <select name="axis" defaultValue={axis} className="rounded border border-[var(--border)] px-1.5 py-0.5 text-xxs">
                {AXES.map((a) => (
                  <option key={a.key} value={a.key}>{a.label}</option>
                ))}
              </select>
              <button className="rounded border border-[var(--border)] px-2 py-0.5 text-xxs">表示</button>
            </form>
          }
        >
          {rows.length === 0 ? (
            <Empty>集計対象の選考データがありません。</Empty>
          ) : (
            <Table head={['区分', '応募', '書類通過', '書類通過率', '一次通過', '内定', '承諾', '承諾率']}>
              {rows.map((row) => (
                <Row key={row.key}>
                  <Cell className="font-medium">{row.label}</Cell>
                  <Cell className="tabular">{row.stats.applied}</Cell>
                  <Cell className="tabular">{row.stats.documentPassed}</Cell>
                  <Cell className="tabular">{row.stats.documentPassRate}%</Cell>
                  <Cell className="tabular">{row.stats.interview1Passed}</Cell>
                  <Cell className="tabular">{row.stats.offered}</Cell>
                  <Cell className="tabular">{row.stats.accepted}</Cell>
                  <Cell className="tabular">{row.stats.acceptanceRate}%</Cell>
                </Row>
              ))}
            </Table>
          )}
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="キャリアチェンジ 成功パターン (§35)" subtitle="候補者の主職種 → 応募求人の職種">
            {patterns.length === 0 ? (
              <Empty>遷移を判定できる選考データがまだありません。</Empty>
            ) : (
              <Table head={['遷移', '推薦', '書類通過', '通過率', '内定', '承諾']}>
                {patterns.map((p) => (
                  <Row key={`${p.from}-${p.to}`}>
                    <Cell className="font-medium">
                      {p.from} → {p.to}
                    </Cell>
                    <Cell className="tabular">{p.recommended}</Cell>
                    <Cell className="tabular">{p.documentPassed}</Cell>
                    <Cell className="tabular">{p.documentPassRate}%</Cell>
                    <Cell className="tabular">{p.offered}</Cell>
                    <Cell className="tabular">{p.accepted}</Cell>
                  </Row>
                ))}
              </Table>
            )}
          </Card>

          <Card title="見送り理由の分布 (§34)" subtitle="原文はそのまま保持し、タグで集計します">
            {tags.length === 0 ? (
              <Empty>見送り理由の記録がありません。</Empty>
            ) : (
              <Table head={['タグ', '件数']}>
                {tags.map((t) => (
                  <Row key={t.tag}>
                    <Cell>{REJECTION_TAG_LABELS[t.tag as RejectionTag] ?? '未タグ'}</Cell>
                    <Cell className="tabular">{t.count}</Cell>
                  </Row>
                ))}
              </Table>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
