'use client';

import { useActionState, useMemo, useState } from 'react';
import { Chip, OptionButton, Select, SubmitButton } from '@/components/ui/forms';
import {
  AGE_BANDS,
  DESIRED_CONDITIONS,
  EDUCATION_LEVELS,
  EMPLOYMENT_TYPES,
  EXPERIENCE_OPTIONS,
  INDUSTRIES,
  JOB_CHANGE_TIMINGS,
  NEARBY_PREFECTURES,
  PREFECTURES,
  SALARY_BANDS,
} from '@/domain/diagnosis/input-schema';
import { submitDiagnosisAction, type SubmitDiagnosisState } from '../actions';

export interface MasterOption {
  id: string;
  name: string;
  category: string;
}

interface Answers {
  ageBand: string;
  salaryBand: string;
  occupationId: string;
  industry: string;
  experienceYears: number | null;
  employmentType: string;
  skillIds: string[];
  certificationIds: string[];
  hasManagementExperience: boolean | null;
  educationLevel: string;
  currentPrefecture: string;
  desiredPrefectures: string[];
  workStyles: string[];
  desiredConditions: string[];
  jobChangeTiming: string;
}

const EMPTY: Answers = {
  ageBand: '',
  salaryBand: '',
  occupationId: '',
  industry: '',
  experienceYears: null,
  employmentType: '',
  skillIds: [],
  certificationIds: [],
  hasManagementExperience: null,
  educationLevel: '',
  currentPrefecture: '',
  desiredPrefectures: [],
  workStyles: [],
  desiredConditions: [],
  jobChangeTiming: '',
};

const WORK_STYLES = [
  { value: 'relocation', label: '転勤できる' },
  { value: 'businessTrip', label: '出張できる' },
  { value: 'nightShift', label: '夜勤・交替勤務できる' },
] as const;

const TOTAL_STEPS = 15;
const initialState: SubmitDiagnosisState = {};

function toggle(list: string[], value: string, max?: number): string[] {
  if (list.includes(value)) return list.filter((v) => v !== value);
  if (max && list.length >= max) return list;
  return [...list, value];
}

export function Questionnaire({
  occupations,
  skills,
  certifications,
}: {
  occupations: MasterOption[];
  skills: MasterOption[];
  certifications: MasterOption[];
}) {
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const [step, setStep] = useState(0);
  const [state, formAction] = useActionState(submitDiagnosisAction, initialState);

  const set = <K extends keyof Answers>(key: K, value: Answers[K], advance = true) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    if (advance) setTimeout(() => setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1)), 120);
  };

  /** Skills are ordered so the ones tied to the selected occupation come first. */
  const orderedSkills = useMemo(() => {
    const groups = new Map<string, MasterOption[]>();
    for (const skill of skills) {
      const list = groups.get(skill.category) ?? [];
      list.push(skill);
      groups.set(skill.category, list);
    }
    return [...groups.entries()];
  }, [skills]);

  const groupedCertifications = useMemo(() => {
    const groups = new Map<string, MasterOption[]>();
    for (const cert of certifications) {
      const list = groups.get(cert.category) ?? [];
      list.push(cert);
      groups.set(cert.category, list);
    }
    return [...groups.entries()];
  }, [certifications]);

  const payload = useMemo(
    () => ({
      salaryBand: answers.salaryBand,
      occupationId: answers.occupationId,
      industry: answers.industry,
      experienceYears: answers.experienceYears ?? 0,
      certificationIds: answers.certificationIds,
      skillIds: answers.skillIds,
      hasManagementExperience: answers.hasManagementExperience ?? false,
      employmentType: answers.employmentType,
      currentPrefecture: answers.currentPrefecture,
      desiredPrefectures: answers.desiredPrefectures.length
        ? answers.desiredPrefectures
        : [answers.currentPrefecture].filter(Boolean),
      relocationOk: answers.workStyles.includes('relocation'),
      businessTripOk: answers.workStyles.includes('businessTrip'),
      nightShiftOk: answers.workStyles.includes('nightShift'),
      educationLevel: answers.educationLevel,
      desiredConditions: answers.desiredConditions,
      ageBand: answers.ageBand,
      jobChangeTiming: answers.jobChangeTiming,
    }),
    [answers],
  );

  const steps: { title: string; hint?: string; body: React.ReactNode; canProceed: boolean }[] = [
    {
      title: 'あなたの年代を教えてください',
      canProceed: Boolean(answers.ageBand),
      body: (
        <div className="space-y-2.5">
          {AGE_BANDS.map((band) => (
            <OptionButton key={band} selected={answers.ageBand === band} onClick={() => set('ageBand', band)}>
              {band}
            </OptionButton>
          ))}
        </div>
      ),
    },
    {
      title: '現在の年収を教えてください',
      hint: '税込・年収ベースのおおよそで大丈夫です',
      canProceed: Boolean(answers.salaryBand),
      body: (
        <div className="space-y-2.5">
          {SALARY_BANDS.map((band) => (
            <OptionButton
              key={band.value}
              selected={answers.salaryBand === band.value}
              onClick={() => set('salaryBand', band.value)}
            >
              {band.label}
            </OptionButton>
          ))}
        </div>
      ),
    },
    {
      title: '現在の職種に最も近いものは？',
      canProceed: Boolean(answers.occupationId),
      body: (
        <div className="space-y-2.5">
          {occupations.map((occupation) => (
            <OptionButton
              key={occupation.id}
              selected={answers.occupationId === occupation.id}
              onClick={() => set('occupationId', occupation.id)}
              sub={occupation.category}
            >
              {occupation.name}
            </OptionButton>
          ))}
        </div>
      ),
    },
    {
      title: '今の業界は？',
      canProceed: Boolean(answers.industry),
      body: (
        <div className="flex flex-wrap gap-2">
          {INDUSTRIES.map((industry) => (
            <Chip
              key={industry}
              selected={answers.industry === industry}
              onClick={() => set('industry', industry)}
            >
              {industry}
            </Chip>
          ))}
        </div>
      ),
    },
    {
      title: 'その仕事の経験年数は？',
      canProceed: answers.experienceYears !== null,
      body: (
        <div className="space-y-2.5">
          {EXPERIENCE_OPTIONS.map((option) => (
            <OptionButton
              key={option.value}
              selected={answers.experienceYears === option.value}
              onClick={() => set('experienceYears', option.value)}
            >
              {option.label}
            </OptionButton>
          ))}
        </div>
      ),
    },
    {
      title: '現在の雇用形態は？',
      canProceed: Boolean(answers.employmentType),
      body: (
        <div className="flex flex-wrap gap-2">
          {EMPLOYMENT_TYPES.map((type) => (
            <Chip
              key={type.value}
              selected={answers.employmentType === type.value}
              onClick={() => set('employmentType', type.value)}
            >
              {type.label}
            </Chip>
          ))}
        </div>
      ),
    },
    {
      title: '経験のある業務をすべて選んでください',
      hint: 'ここが市場価値の評価につながります',
      canProceed: answers.skillIds.length > 0,
      body: (
        <div className="space-y-4">
          {orderedSkills.map(([category, items]) => (
            <div key={category}>
              <p className="mb-2 text-xs font-semibold text-ink-500">{category}</p>
              <div className="flex flex-wrap gap-2">
                {items.map((skill) => (
                  <Chip
                    key={skill.id}
                    selected={answers.skillIds.includes(skill.id)}
                    onClick={() => set('skillIds', toggle(answers.skillIds, skill.id), false)}
                  >
                    {skill.name}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      title: '持っている資格を選んでください',
      hint: '該当がなければそのまま次へ進めます',
      canProceed: true,
      body: (
        <div className="space-y-4">
          {groupedCertifications.map(([category, items]) => (
            <div key={category}>
              <p className="mb-2 text-xs font-semibold text-ink-500">{category}</p>
              <div className="flex flex-wrap gap-2">
                {items.map((cert) => (
                  <Chip
                    key={cert.id}
                    selected={answers.certificationIds.includes(cert.id)}
                    onClick={() => set('certificationIds', toggle(answers.certificationIds, cert.id), false)}
                  >
                    {cert.name}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      title: '後輩指導やチームをまとめた経験はありますか？',
      canProceed: answers.hasManagementExperience !== null,
      body: (
        <div className="space-y-2.5">
          <OptionButton
            selected={answers.hasManagementExperience === true}
            onClick={() => set('hasManagementExperience', true)}
          >
            ある
          </OptionButton>
          <OptionButton
            selected={answers.hasManagementExperience === false}
            onClick={() => set('hasManagementExperience', false)}
          >
            ない
          </OptionButton>
        </div>
      ),
    },
    {
      title: '最終学歴を教えてください',
      canProceed: Boolean(answers.educationLevel),
      body: (
        <div className="flex flex-wrap gap-2">
          {EDUCATION_LEVELS.map((level) => (
            <Chip
              key={level.value}
              selected={answers.educationLevel === level.value}
              onClick={() => set('educationLevel', level.value)}
            >
              {level.label}
            </Chip>
          ))}
        </div>
      ),
    },
    {
      title: '現在の勤務地は？',
      canProceed: Boolean(answers.currentPrefecture),
      body: (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {NEARBY_PREFECTURES.map((prefecture) => (
              <Chip
                key={prefecture}
                selected={answers.currentPrefecture === prefecture}
                onClick={() => set('currentPrefecture', prefecture)}
              >
                {prefecture}
              </Chip>
            ))}
          </div>
          <Select
            aria-label="その他の都道府県"
            value={answers.currentPrefecture}
            onChange={(event) => set('currentPrefecture', event.target.value, false)}
          >
            <option value="">その他の都道府県から選ぶ</option>
            {PREFECTURES.map((prefecture) => (
              <option key={prefecture} value={prefecture}>
                {prefecture}
              </option>
            ))}
          </Select>
        </div>
      ),
    },
    {
      title: '希望する勤務地は？',
      hint: '複数選択できます（最大5つ）',
      canProceed: answers.desiredPrefectures.length > 0,
      body: (
        <div className="flex flex-wrap gap-2">
          {[
            ...new Set([answers.currentPrefecture, ...NEARBY_PREFECTURES].filter(Boolean)),
          ].map((prefecture) => (
            <Chip
              key={prefecture}
              selected={answers.desiredPrefectures.includes(prefecture)}
              onClick={() => set('desiredPrefectures', toggle(answers.desiredPrefectures, prefecture, 5), false)}
            >
              {prefecture}
            </Chip>
          ))}
        </div>
      ),
    },
    {
      title: '対応できる働き方を選んでください',
      hint: '選べる働き方が多いほど、狙える職種が広がります',
      canProceed: true,
      body: (
        <div className="space-y-2.5">
          {WORK_STYLES.map((style) => (
            <OptionButton
              key={style.value}
              selected={answers.workStyles.includes(style.value)}
              onClick={() => set('workStyles', toggle(answers.workStyles, style.value), false)}
            >
              {style.label}
            </OptionButton>
          ))}
        </div>
      ),
    },
    {
      title: '転職で重視したい条件は？',
      hint: '複数選択できます',
      canProceed: true,
      body: (
        <div className="flex flex-wrap gap-2">
          {DESIRED_CONDITIONS.map((condition) => (
            <Chip
              key={condition}
              selected={answers.desiredConditions.includes(condition)}
              onClick={() => set('desiredConditions', toggle(answers.desiredConditions, condition), false)}
            >
              {condition}
            </Chip>
          ))}
        </div>
      ),
    },
    {
      title: '転職を考えている時期は？',
      canProceed: Boolean(answers.jobChangeTiming),
      body: (
        <div className="space-y-2.5">
          {JOB_CHANGE_TIMINGS.map((timing) => (
            <OptionButton
              key={timing}
              selected={answers.jobChangeTiming === timing}
              onClick={() => set('jobChangeTiming', timing, false)}
            >
              {timing}
            </OptionButton>
          ))}
        </div>
      ),
    },
  ];

  const current = steps[step];
  const isLast = step === TOTAL_STEPS - 1;
  const progress = ((step + (current?.canProceed ? 1 : 0)) / TOTAL_STEPS) * 100;

  if (!current) return null;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-10 bg-white px-6 pt-6 pb-3">
        <div className="flex items-center justify-between text-xs text-ink-500">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="rounded-lg px-2 py-1 disabled:invisible hover:bg-slate-100"
          >
            ← 戻る
          </button>
          <span className="tabular">
            {step + 1} / {TOTAL_STEPS}
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-brand-600 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      <div className="flex-1 px-6 pb-6">
        <h1 className="text-xl leading-snug font-bold text-ink-900">{current.title}</h1>
        {current.hint && <p className="mt-1.5 text-xs text-ink-500">{current.hint}</p>}
        <div className="mt-6">{current.body}</div>
      </div>

      <footer className="sticky bottom-0 space-y-3 border-t border-slate-100 bg-white px-6 py-4">
        {state.error && (
          <p role="alert" className="rounded-xl bg-rose-50 px-4 py-2.5 text-xs text-rose-700">
            {state.error}
          </p>
        )}
        {isLast ? (
          <form action={formAction}>
            <input type="hidden" name="answers" value={JSON.stringify(payload)} />
            <SubmitButton size="lg" disabled={!current.canProceed} pendingLabel="診断しています...">
              診断結果を見る
            </SubmitButton>
          </form>
        ) : (
          <button
            type="button"
            disabled={!current.canProceed}
            onClick={() => setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1))}
            className="w-full rounded-xl bg-brand-600 px-5 py-4 text-base font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            次へ
          </button>
        )}
      </footer>
    </div>
  );
}
