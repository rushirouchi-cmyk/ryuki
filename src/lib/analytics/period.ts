import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
} from "date-fns";

export const PERIOD_PRESETS = [
  { key: "today", label: "今日" },
  { key: "week", label: "今週" },
  { key: "month", label: "今月" },
  { key: "last30", label: "直近30日" },
  { key: "all", label: "全期間" },
] as const;

export type PeriodKey = (typeof PERIOD_PRESETS)[number]["key"];

export interface Period {
  key: PeriodKey | "custom";
  label: string;
  from: Date;
  to: Date;
}

/**
 * Resolves the dashboard period from the query string. `from`/`to` win over a
 * preset so any comparison view can be deep-linked.
 */
export function resolvePeriod(searchParams: Record<string, string | undefined>): Period {
  const now = new Date();

  if (searchParams.from && searchParams.to) {
    const from = new Date(searchParams.from);
    const to = new Date(searchParams.to);
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
      return {
        key: "custom",
        label: `${searchParams.from} 〜 ${searchParams.to}`,
        from: startOfDay(from),
        to: endOfDay(to),
      };
    }
  }

  const key = (searchParams.period ?? "last30") as PeriodKey;
  switch (key) {
    case "today":
      return { key, label: "今日", from: startOfDay(now), to: endOfDay(now) };
    case "week":
      return {
        key,
        label: "今週",
        from: startOfWeek(now, { weekStartsOn: 1 }),
        to: endOfWeek(now, { weekStartsOn: 1 }),
      };
    case "month":
      return { key, label: "今月", from: startOfMonth(now), to: endOfMonth(now) };
    case "all":
      return { key, label: "全期間", from: new Date(2000, 0, 1), to: endOfDay(now) };
    case "last30":
    default:
      return {
        key: "last30",
        label: "直近30日",
        from: startOfDay(subDays(now, 29)),
        to: endOfDay(now),
      };
  }
}

/** Parses repeatable filter params (`?venueType=a&venueType=b`). */
export function parseList(value: string | string[] | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  const values = (Array.isArray(value) ? value : [value]).filter(
    (item) => item.length > 0,
  );
  return values.length > 0 ? values : undefined;
}

export function parseNumberList(
  value: string | string[] | undefined,
): number[] | undefined {
  const values = parseList(value);
  if (!values) return undefined;
  const numbers = values.map(Number).filter((item) => Number.isFinite(item));
  return numbers.length > 0 ? numbers : undefined;
}
