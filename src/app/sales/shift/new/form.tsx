"use client";

import { useActionState } from "react";
import { Button, Card, ErrorText, Field, Select, Textarea } from "@/components/ui";
import { VENUE_TYPE_LABELS, WEATHER_LABELS } from "@/lib/utils/labels";
import { startShiftAction, type SalesActionState } from "../../actions";

export interface LocationOption {
  id: number;
  venueName: string;
  prefecture: string;
  city: string;
  venueType: string;
}

/** `datetime-local` needs a local-time string, not an ISO/UTC one. */
function toLocalInput(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function StartShiftForm({ locations }: { locations: LocationOption[] }) {
  const [state, action, pending] = useActionState<SalesActionState, FormData>(
    startShiftAction,
    {},
  );

  const now = new Date();
  const defaultEnd = new Date(now.getTime() + 4 * 3_600_000);

  return (
    <Card>
      <form action={action} className="space-y-4">
        <Field label="営業場所" required>
          <Select name="locationId" required defaultValue="">
            <option value="" disabled>
              選択してください
            </option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.venueName}（{location.prefecture}
                {location.city}・{VENUE_TYPE_LABELS[location.venueType] ?? location.venueType}）
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="開始時刻" required>
            <input
              name="startTime"
              type="datetime-local"
              required
              defaultValue={toLocalInput(now)}
              className="w-full rounded-xl border border-ink-300 bg-white px-3 py-2.5 text-sm"
            />
          </Field>
          <Field label="終了予定時刻" required>
            <input
              name="plannedEndTime"
              type="datetime-local"
              required
              defaultValue={toLocalInput(defaultEnd)}
              className="w-full rounded-xl border border-ink-300 bg-white px-3 py-2.5 text-sm"
            />
          </Field>
        </div>

        <Field label="天候" hint="地域・時間帯の成果分析に使用します">
          <Select name="weather" defaultValue="">
            <option value="">未入力</option>
            {Object.entries(WEATHER_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="メモ">
          <Textarea name="memo" rows={2} maxLength={500} />
        </Field>

        <ErrorText>{state.error}</ErrorText>

        <Button type="submit" size="lg" full disabled={pending}>
          {pending ? "作成中…" : "営業開始してQRを発行"}
        </Button>
      </form>
    </Card>
  );
}
