'use client';

import { useActionState } from 'react';
import { Field, Input, Select, SubmitButton } from '@/components/ui/forms';
import { startShiftAction, type ShiftState } from '../actions';
import { VENUE_TYPE_LABELS, WEATHER_LABELS } from '@/lib/format';

export interface LocationOption {
  id: string;
  label: string;
  venueType: string;
}

function localDateTimeValue(offsetMinutes = 0): string {
  const date = new Date(Date.now() + offsetMinutes * 60_000);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ShiftForm({ locations }: { locations: LocationOption[] }) {
  const [state, formAction] = useActionState<ShiftState, FormData>(startShiftAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <Field label="営業場所" required>
        <Select name="locationId" required defaultValue="">
          <option value="" disabled>
            場所を選択
          </option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="場所カテゴリ" required>
        <Select name="venueType" required defaultValue={locations[0]?.venueType ?? 'station'}>
          {Object.entries(VENUE_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="開始時刻" required>
        <Input type="datetime-local" name="startTime" required defaultValue={localDateTimeValue()} />
      </Field>
      <Field label="終了予定時刻">
        <Input type="datetime-local" name="plannedEndTime" defaultValue={localDateTimeValue(240)} />
      </Field>
      <Field label="天候">
        <Select name="weather" defaultValue="sunny">
          {Object.entries(WEATHER_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="メモ" hint="任意（イベント有無、人通りなど）">
        <Input name="memo" placeholder="週末イベント開催中" />
      </Field>
      {state.error && (
        <p role="alert" className="rounded-xl bg-rose-50 px-4 py-2.5 text-xs text-rose-700">
          {state.error}
        </p>
      )}
      <SubmitButton size="lg" pendingLabel="開始しています...">
        営業を開始してQRを発行
      </SubmitButton>
    </form>
  );
}
