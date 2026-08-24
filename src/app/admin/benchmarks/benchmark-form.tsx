'use client';

import { useActionState } from 'react';
import { Field, Input, Select, SubmitButton } from '@/components/ui/forms';
import { upsertBenchmarkAction, type ActionState } from '@/app/admin/actions';

export interface BenchmarkFormOptions {
  occupations: { id: string; name: string }[];
  regions: { id: string; name: string }[];
  experienceBands: readonly string[];
  educationLevels: readonly string[];
  confidenceLevels: readonly string[];
  today: string;
}

const SOURCES = [
  { value: 'manual', label: '手入力' },
  { value: 'public_statistics', label: '公的統計' },
  { value: 'job_posting', label: '求人データ' },
  { value: 'internal_outcome', label: '自社転職実績' },
];

export function BenchmarkForm({ options }: { options: BenchmarkFormOptions }) {
  const [state, formAction] = useActionState<ActionState, FormData>(upsertBenchmarkAction, {});

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Field label="職種" required>
        <Select name="occupationId" required defaultValue="">
          <option value="" disabled>
            選択
          </option>
          {options.occupations.map((occupation) => (
            <option key={occupation.id} value={occupation.id}>
              {occupation.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="地域" required>
        <Select name="regionId" required defaultValue="">
          <option value="" disabled>
            選択
          </option>
          {options.regions.map((region) => (
            <option key={region.id} value={region.id}>
              {region.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="経験年数帯" required>
        <Select name="experienceBand" required defaultValue={options.experienceBands[0]}>
          {options.experienceBands.map((band) => (
            <option key={band} value={band}>
              {band} 年
            </option>
          ))}
        </Select>
      </Field>
      <Field label="学歴" hint="空欄なら学歴を問わない行として扱われます">
        <Select name="educationLevel" defaultValue="">
          <option value="">指定なし</option>
          {options.educationLevels.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="年収 low（円）" required>
        <Input name="salaryLow" type="number" step={10000} min={0} required />
      </Field>
      <Field label="年収 median（円）" required>
        <Input name="salaryMedian" type="number" step={10000} min={0} required />
      </Field>
      <Field label="年収 high（円）" required>
        <Input name="salaryHigh" type="number" step={10000} min={0} required />
      </Field>
      <Field label="データソース" required>
        <Select name="source" defaultValue="manual">
          {SOURCES.map((source) => (
            <option key={source.value} value={source.value}>
              {source.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="出典日" required>
        <Input name="sourceDate" type="date" required defaultValue={options.today} />
      </Field>
      <Field label="信頼度" required>
        <Select name="confidenceLevel" defaultValue="medium">
          {options.confidenceLevels.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="サンプル数" hint="任意">
        <Input name="sampleSize" type="number" min={0} step={1} />
      </Field>
      <div className="flex items-end">
        <SubmitButton pendingLabel="保存中...">登録 / 上書き</SubmitButton>
      </div>
      {(state.error || state.success) && (
        <p
          className={`sm:col-span-2 xl:col-span-4 text-xs ${state.error ? 'text-rose-600' : 'text-emerald-600'}`}
        >
          {state.error ?? state.success}
        </p>
      )}
    </form>
  );
}
