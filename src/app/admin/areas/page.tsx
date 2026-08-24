import { getDb } from "@/lib/db";
import { getBreakdown, getFilterOptions } from "@/lib/analytics/queries";
import { buildFilter } from "@/lib/analytics/filter-params";
import { computeAreaScores } from "@/lib/analytics/area-score";
import { getAreaScoreConfig } from "@/lib/config/store";
import { Card, CardTitle, EmptyState, PageHeader } from "@/components/ui";
import { PeriodTabs } from "@/components/analytics/period-tabs";
import { FilterBar } from "@/components/analytics/filter-bar";
import { BreakdownTable } from "@/components/analytics/breakdown-table";
import type { BreakdownDimension } from "@/lib/analytics/types";

const DIMENSIONS: { key: BreakdownDimension; label: string }[] = [
  { key: "location", label: "営業場所" },
  { key: "venue_type", label: "場所カテゴリ" },
  { key: "prefecture", label: "都道府県" },
  { key: "city", label: "市区町村" },
  { key: "weather", label: "天候" },
];

export default async function AreasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { period, filter } = buildFilter(params);
  const db = await getDb();

  const [options, config] = await Promise.all([
    getFilterOptions(db),
    getAreaScoreConfig(db),
  ]);

  const sections = await Promise.all(
    DIMENSIONS.map(async (dimension) => ({
      ...dimension,
      rows: await getBreakdown(db, filter, dimension.key),
    })),
  );

  const primary = sections[0];
  const scores = primary ? computeAreaScores(primary.rows, config) : undefined;

  return (
    <>
      <PageHeader
        title="エリア分析"
        description={`${period.label}｜Gross Profit / Sales Hour を最重要指標として比較します`}
        actions={<PeriodTabs active={period.key} />}
      />

      <Card className="mb-6">
        <CardTitle>絞り込み</CardTitle>
        <div className="mt-3">
          <FilterBar options={options} />
        </div>
      </Card>

      {sections.map((section, index) => (
        <section key={section.key} className="mb-8">
          <CardTitle>{section.label}別</CardTitle>
          <div className="mt-2">
            {section.rows.length === 0 ? (
              <EmptyState
                title="対象データがありません"
                description="期間や絞り込み条件を変更してください。"
              />
            ) : (
              <BreakdownTable
                rows={section.rows}
                scores={index === 0 ? scores : undefined}
                labelHeader={section.label}
              />
            )}
          </div>
          {index === 0 ? (
            <p className="mt-2 text-xs text-ink-500">
              エリアスコアは同一期間内の相対評価です。営業時間
              {config.minSalesHours}h・声掛け{config.minApproaches}件に満たないエリアは
              「参考値」と表示され、実績が十分なエリアと同列には比較できません。
            </p>
          ) : null}
        </section>
      ))}
    </>
  );
}
