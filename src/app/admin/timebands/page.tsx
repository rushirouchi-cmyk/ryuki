import { getDb } from "@/lib/db";
import { getBreakdown, getFilterOptions } from "@/lib/analytics/queries";
import { buildFilter } from "@/lib/analytics/filter-params";
import { computeAreaScores } from "@/lib/analytics/area-score";
import { getAreaScoreConfig } from "@/lib/config/store";
import { Card, CardTitle, EmptyState, PageHeader } from "@/components/ui";
import { PeriodTabs } from "@/components/analytics/period-tabs";
import { FilterBar } from "@/components/analytics/filter-bar";
import { BreakdownTable } from "@/components/analytics/breakdown-table";

export default async function TimeBandsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { period, filter } = buildFilter(params);
  const db = await getDb();

  const [options, config, weekday, timeBand, areaTimeBand] = await Promise.all([
    getFilterOptions(db),
    getAreaScoreConfig(db),
    getBreakdown(db, filter, "weekday"),
    getBreakdown(db, filter, "time_band"),
    getBreakdown(db, filter, "area_time_band"),
  ]);

  /* Only rank combinations that actually carry enough volume to compare. */
  const ranked = [...areaTimeBand].sort(
    (a, b) =>
      (b.economics.grossProfitPerSalesHour ?? -Infinity) -
      (a.economics.grossProfitPerSalesHour ?? -Infinity),
  );
  const scores = computeAreaScores(areaTimeBand, config);

  return (
    <>
      <PageHeader
        title="時間帯分析"
        description={`${period.label}｜「どの街が強いか」ではなく「どの場所の・どの曜日の・どの時間帯が強いか」で見ます`}
        actions={<PeriodTabs active={period.key} />}
      />

      <Card className="mb-6">
        <CardTitle>絞り込み</CardTitle>
        <div className="mt-3">
          <FilterBar options={options} />
        </div>
      </Card>

      <section className="mb-8">
        <CardTitle>曜日別</CardTitle>
        <div className="mt-2">
          <BreakdownTable rows={weekday} labelHeader="曜日" />
        </div>
      </section>

      <section className="mb-8">
        <CardTitle>時間帯別</CardTitle>
        <div className="mt-2">
          <BreakdownTable rows={timeBand} labelHeader="時間帯" />
        </div>
      </section>

      <section>
        <CardTitle>営業場所 × 曜日 × 時間帯（粗利/h 上位）</CardTitle>
        <div className="mt-2">
          {ranked.length === 0 ? (
            <EmptyState title="対象データがありません" />
          ) : (
            <BreakdownTable
              rows={ranked.slice(0, 25)}
              scores={scores}
              labelHeader="営業場所 / 曜日・時間帯"
            />
          )}
        </div>
        <p className="mt-2 text-xs text-ink-500">
          1組み合わせあたりの営業時間は短くなりがちです。「参考値」表示の行はサンプル不足のため、
          単独では意思決定の根拠になりません。
        </p>
      </section>
    </>
  );
}
