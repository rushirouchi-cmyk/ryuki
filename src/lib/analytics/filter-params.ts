import type { AnalyticsFilter } from "./types";
import { parseList, parseNumberList, resolvePeriod, type Period } from "./period";

/** Turns the admin query string into a validated analytics filter. */
export function buildFilter(params: Record<string, string | undefined>): {
  period: Period;
  filter: AnalyticsFilter;
} {
  const period = resolvePeriod(params);

  return {
    period,
    filter: {
      from: period.from,
      to: period.to,
      locationIds: parseNumberList(params.locationId),
      prefectures: parseList(params.prefecture),
      cities: parseList(params.city),
      venueTypes: parseList(params.venueType),
      salesUserIds: parseList(params.salesUserId),
      weekdays: parseNumberList(params.weekday),
      timeBands: parseList(params.timeBand),
      weather: parseList(params.weather),
    },
  };
}
