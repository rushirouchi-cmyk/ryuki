"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui";
import { DAY_OF_WEEK_LABELS, VENUE_TYPE_LABELS, WEATHER_LABELS } from "@/lib/utils/labels";
import { TIME_BANDS } from "@/lib/analytics/types";

export interface FilterOptions {
  locations: { id: number; venueName: string; prefecture: string; city: string }[];
  salesUsers: { id: string; name: string }[];
  prefectures: string[];
  venueTypes: string[];
}

/**
 * Every dimension the area analysis can slice by. Single-select per dimension
 * keeps the URL readable; the query layer already accepts arrays for later.
 */
export function FilterBar({ options }: { options: FilterOptions }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const update = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  };

  const current = (key: string) => searchParams.get(key) ?? "";

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <label className="block">
        <span className="mb-1 block text-xs text-ink-500">都道府県</span>
        <Select
          value={current("prefecture")}
          onChange={(event) => update("prefecture", event.target.value)}
        >
          <option value="">すべて</option>
          {options.prefectures.map((prefecture) => (
            <option key={prefecture} value={prefecture}>
              {prefecture}
            </option>
          ))}
        </Select>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs text-ink-500">営業場所</span>
        <Select
          value={current("locationId")}
          onChange={(event) => update("locationId", event.target.value)}
        >
          <option value="">すべて</option>
          {options.locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.venueName}
            </option>
          ))}
        </Select>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs text-ink-500">場所カテゴリ</span>
        <Select
          value={current("venueType")}
          onChange={(event) => update("venueType", event.target.value)}
        >
          <option value="">すべて</option>
          {options.venueTypes.map((venueType) => (
            <option key={venueType} value={venueType}>
              {VENUE_TYPE_LABELS[venueType] ?? venueType}
            </option>
          ))}
        </Select>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs text-ink-500">営業担当</span>
        <Select
          value={current("salesUserId")}
          onChange={(event) => update("salesUserId", event.target.value)}
        >
          <option value="">すべて</option>
          {options.salesUsers.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </Select>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs text-ink-500">曜日</span>
        <Select
          value={current("weekday")}
          onChange={(event) => update("weekday", event.target.value)}
        >
          <option value="">すべて</option>
          {DAY_OF_WEEK_LABELS.map((label, index) => (
            <option key={label} value={index}>
              {label}曜
            </option>
          ))}
        </Select>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs text-ink-500">時間帯</span>
        <Select
          value={current("timeBand")}
          onChange={(event) => update("timeBand", event.target.value)}
        >
          <option value="">すべて</option>
          {TIME_BANDS.map((band) => (
            <option key={band.key} value={band.key}>
              {band.label}
            </option>
          ))}
        </Select>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs text-ink-500">天候</span>
        <Select
          value={current("weather")}
          onChange={(event) => update("weather", event.target.value)}
        >
          <option value="">すべて</option>
          {Object.entries(WEATHER_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </label>
    </div>
  );
}
