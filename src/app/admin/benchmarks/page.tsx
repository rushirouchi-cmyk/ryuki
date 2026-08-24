import { asc } from 'drizzle-orm';
import { Alert, Badge, Card, EmptyState, Table, Td, Th } from '@/components/ui';
import { requireAdmin } from '@/server/guards';
import { getDb, schema } from '@/db/client';
import { formatDate, formatManYen, formatNumber } from '@/lib/format';
import { deleteBenchmarkAction } from '../actions';
import { BenchmarkForm } from './benchmark-form';

export const dynamic = 'force-dynamic';

export default async function BenchmarksPage({
  searchParams,
}: {
  searchParams: Promise<{ occupationId?: string }>;
}) {
  await requireAdmin();
  const query = await searchParams;
  const db = getDb();

  const [occupations, regions, benchmarks] = await Promise.all([
    db.query.occupations.findMany({ orderBy: [asc(schema.occupations.name)] }),
    db.query.regions.findMany(),
    db.query.salaryMarketBenchmarks.findMany({
      orderBy: [asc(schema.salaryMarketBenchmarks.occupationId), asc(schema.salaryMarketBenchmarks.experienceBand)],
    }),
  ]);

  const occupationById = new Map(occupations.map((occupation) => [occupation.id, occupation]));
  const regionById = new Map(regions.map((region) => [region.id, region]));
  const filtered = query.occupationId
    ? benchmarks.filter((row) => row.occupationId === query.occupationId)
    : benchmarks;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-ink-900">市場年収マスター</h1>
        <p className="text-xs text-ink-500">
          年収診断の土台になるデータです。MVP段階では手入力で運用し、将来は公的統計・求人データ・自社転職実績を
          同じテーブルへ取り込みます（source 列でデータソースを区別）。
        </p>
      </div>

      <Alert tone="info">
        診断は「職種 × 地域 × 経験年数帯 × 学歴」で参照し、該当がなければ「学歴指定なし」→「全国」の順に
        フォールバックします。全国行を1つ用意しておくと、データ未整備の地域でも診断が成立します。
      </Alert>

      <Card title="登録・上書き" description="同じ 職種 × 地域 × 経験年数帯 × 学歴 の行は上書きされます">
        <BenchmarkForm
          options={{
            occupations: occupations.map((o) => ({ id: o.id, name: o.name })),
            regions: regions.map((r) => ({ id: r.id, name: r.name })),
            experienceBands: schema.experienceBandEnum.enumValues,
            educationLevels: schema.educationLevelEnum.enumValues,
            confidenceLevels: schema.confidenceLevelEnum.enumValues,
            today: new Date().toISOString().slice(0, 10),
          }}
        />
      </Card>

      <Card
        title={`登録済みデータ（${formatNumber(filtered.length)} 件）`}
        action={
          <form action="/admin/benchmarks">
            <select
              name="occupationId"
              defaultValue={query.occupationId ?? ''}
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
              aria-label="職種で絞り込み"
            >
              <option value="">すべての職種</option>
              {occupations.map((occupation) => (
                <option key={occupation.id} value={occupation.id}>
                  {occupation.name}
                </option>
              ))}
            </select>
            <button type="submit" className="ml-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs">
              絞り込む
            </button>
          </form>
        }
      >
        {filtered.length === 0 ? (
          <EmptyState title="市場年収データがありません" description="上のフォームから登録してください。" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>職種</Th>
                <Th>地域</Th>
                <Th>経験年数帯</Th>
                <Th>学歴</Th>
                <Th align="right">low</Th>
                <Th align="right">median</Th>
                <Th align="right">high</Th>
                <Th>ソース</Th>
                <Th>出典日</Th>
                <Th align="center">信頼度</Th>
                <Th align="right">n</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <Td>{occupationById.get(row.occupationId)?.name ?? '—'}</Td>
                  <Td>{regionById.get(row.regionId)?.name ?? '—'}</Td>
                  <Td>{row.experienceBand}</Td>
                  <Td>{row.educationLevel ?? '指定なし'}</Td>
                  <Td align="right">{formatManYen(row.salaryLow)}</Td>
                  <Td align="right">{formatManYen(row.salaryMedian)}</Td>
                  <Td align="right">{formatManYen(row.salaryHigh)}</Td>
                  <Td>{row.source}</Td>
                  <Td>{formatDate(row.sourceDate)}</Td>
                  <Td align="center">
                    <Badge tone={row.confidenceLevel === 'high' ? 'success' : row.confidenceLevel === 'low' ? 'warning' : 'neutral'}>
                      {row.confidenceLevel}
                    </Badge>
                  </Td>
                  <Td align="right">{row.sampleSize ?? '—'}</Td>
                  <Td>
                    <form action={deleteBenchmarkAction}>
                      <input type="hidden" name="benchmarkId" value={row.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                      >
                        削除
                      </button>
                    </form>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
