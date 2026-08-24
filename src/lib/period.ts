export type RangeKey = 'today' | 'week' | 'month' | 'quarter' | 'all' | 'custom';

export interface Period {
  key: RangeKey;
  from: Date;
  to: Date;
  label: string;
}

export const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: 'today', label: '今日' },
  { key: 'week', label: '今週' },
  { key: 'month', label: '今月' },
  { key: 'quarter', label: '直近90日' },
  { key: 'all', label: '全期間' },
];

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Resolves the ?range / ?from / ?to query into a concrete window. */
export function resolvePeriod(params: { range?: string; from?: string; to?: string }): Period {
  const now = new Date();
  const todayStart = startOfDay(now);
  const tomorrow = new Date(todayStart.getTime() + 86_400_000);

  if (params.from && params.to) {
    const from = new Date(params.from);
    const to = new Date(params.to);
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
      return {
        key: 'custom',
        from: startOfDay(from),
        to: new Date(startOfDay(to).getTime() + 86_400_000),
        label: `${params.from} 〜 ${params.to}`,
      };
    }
  }

  switch (params.range) {
    case 'today':
      return { key: 'today', from: todayStart, to: tomorrow, label: '今日' };
    case 'week': {
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
      return { key: 'week', from: weekStart, to: tomorrow, label: '今週' };
    }
    case 'quarter':
      return {
        key: 'quarter',
        from: new Date(todayStart.getTime() - 90 * 86_400_000),
        to: tomorrow,
        label: '直近90日',
      };
    case 'all':
      return { key: 'all', from: new Date('2000-01-01'), to: tomorrow, label: '全期間' };
    case 'month':
    default: {
      const monthStart = new Date(todayStart);
      monthStart.setDate(1);
      return { key: 'month', from: monthStart, to: tomorrow, label: '今月' };
    }
  }
}

export function buildQuery(base: Record<string, string | undefined>, patch: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...base, ...patch })) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}
