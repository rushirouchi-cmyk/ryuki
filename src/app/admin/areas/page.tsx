import { Alert, Card } from '@/components/ui';
import { PeriodFilter } from '@/components/period-filter';
import { SegmentTable } from '@/components/segment-table';
import { ComparisonChart } from '@/components/comparison-chart';
import { requireAdmin } from '@/server/guards';
import {
  loadCohortDataset,
  segmentByAreaDayTime,
  segmentByDayOfWeek,
  segmentByLocation,
  segmentByTimeBand,
  segmentByVenueType,
  segmentByWeather,
} from '@/server/services/analytics';
import { resolvePeriod } from '@/lib/period';
import { getDb } from '@/db/client';
import { AreaFilters } from './filters';
import { VENUE_TYPE_LABELS, WEATHER_LABELS, labelOf } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function AdminAreasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const query = await searchParams;
  const period = resolvePeriod(query);

  const dataset = await loadCohortDataset({
    from: period.from,
    to: period.to,
    prefecture: query.prefecture,
    venueType: query.venueType,
    weather: query.weather,
    dayOfWeek: query.dayOfWeek ? Number(query.dayOfWeek) : undefined,
    timeBand: query.timeBand,
    salesUserId: query.salesUserId,
  });

  const [locations, salesUsers] = await Promise.all([
    getDb().query.locations.findMany(),
    getDb().query.users.findMany(),
  ]);

  const byLocation = segmentByLocation(dataset);
  const byVenueType = segmentByVenueType(dataset).map((segment) => ({
    ...segment,
    label: labelOf(VENUE_TYPE_LABELS, segment.label),
  }));
  const byDay = segmentByDayOfWeek(dataset);
  const byTimeBand = segmentByTimeBand(dataset);
  const byWeather = segmentByWeather(dataset).map((segment) => ({
    ...segment,
    label: labelOf(WEATHER_LABELS, segment.label),
  }));
  const byAreaDayTime = segmentByAreaDayTime(dataset).slice(0, 25);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ink-900">地域・時間帯分析</h1>
          <p className="text-xs text-ink-500">
            単純なQR数ではなく Gross Profit / Sales Hour を主指標として比較します
          </p>
        </div>
        <PeriodFilter period={period} basePath="/admin/areas" query={query} />
      </div>

      <AreaFilters
        query={query}
        prefectures={[...new Set(locations.map((location) => location.prefecture))]}
        timeBands={dataset.config.timeBands.map((band) => band.label)}
        salesUsers={salesUsers
          .filter((user) => user.role === 'sales')
          .map((user) => ({ id: user.id, name: user.displayName }))}
      />

      {byLocation.length === 0 ? (
        <Alert tone="warning">条件に一致するシフトがありません。</Alert>
      ) : (
        <>
          <Card title="場所別" description="粗利/h の高い順">
            <SegmentTable segments={byLocation} firstColumnLabel="場所" />
          </Card>

          <Card title="粗利 / Sales Hour" description="場所別">
            <ComparisonChart
              data={byLocation.map((segment) => ({
                label: segment.label,
                value: Math.round(segment.economics.grossProfitPerSalesHour),
              }))}
              valueLabel="円/h"
            />
          </Card>

          <Card
            title="Area × 曜日 × 時間帯"
            description="「西宮が強い」ではなく「土日11〜16時の商業施設が強い」まで分解します（上位25件）"
          >
            <SegmentTable segments={byAreaDayTime} firstColumnLabel="場所 / 曜日・時間帯" />
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card title="場所カテゴリ別">
              <SegmentTable segments={byVenueType} firstColumnLabel="カテゴリ" showAreaScore={false} />
            </Card>
            <Card title="曜日別">
              <SegmentTable segments={byDay} firstColumnLabel="曜日" showAreaScore={false} />
            </Card>
            <Card title="時間帯別">
              <SegmentTable segments={byTimeBand} firstColumnLabel="時間帯" showAreaScore={false} />
            </Card>
            <Card title="天候別">
              <SegmentTable segments={byWeather} firstColumnLabel="天候" showAreaScore={false} />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
