import type { AnalyticsConfig } from '@/domain/config/analytics-config';

export const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const;

export interface TimeBand {
  label: string;
  startHour: number;
  endHour: number;
}

export function resolveTimeBand(date: Date, config: AnalyticsConfig): TimeBand | null {
  const hour = date.getHours();
  return config.timeBands.find((band) => hour >= band.startHour && hour < band.endHour) ?? null;
}

export function dayOfWeekLabel(date: Date): string {
  return DAY_LABELS[date.getDay()] ?? '';
}

/**
 * Splits a shift across the configured bands so that a 10:00-16:00 shift
 * contributes hours to every band it overlaps rather than only its start band.
 */
export function splitShiftHoursByBand(
  start: Date,
  end: Date,
  config: AnalyticsConfig,
): { band: string; hours: number }[] {
  const result: { band: string; hours: number }[] = [];
  const startMs = start.getTime();
  const endMs = end.getTime();
  if (endMs <= startMs) return result;

  for (const band of config.timeBands) {
    const bandStart = new Date(start);
    bandStart.setHours(band.startHour, 0, 0, 0);
    const bandEnd = new Date(start);
    bandEnd.setHours(band.endHour, 0, 0, 0);
    const overlapStart = Math.max(startMs, bandStart.getTime());
    const overlapEnd = Math.min(endMs, bandEnd.getTime());
    if (overlapEnd > overlapStart) {
      result.push({ band: band.label, hours: (overlapEnd - overlapStart) / 3_600_000 });
    }
  }
  return result;
}
