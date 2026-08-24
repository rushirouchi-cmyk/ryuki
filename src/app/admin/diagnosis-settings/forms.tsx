'use client';

import { useActionState } from 'react';
import { Field, Input, SubmitButton } from '@/components/ui/forms';
import { saveAnalyticsConfigAction, saveDiagnosisConfigAction, type ActionState } from '@/app/admin/actions';
import type { DiagnosisConfig } from '@/domain/config/diagnosis-config';
import type { AnalyticsConfig } from '@/domain/config/analytics-config';

function Result({ state }: { state: ActionState }) {
  if (state.error) return <p className="text-xs text-rose-600">{state.error}</p>;
  if (state.success) return <p className="text-xs text-emerald-600">{state.success}</p>;
  return null;
}

export function DiagnosisConfigForm({ config }: { config: DiagnosisConfig }) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveDiagnosisConfigAction, {});
  const weightTotal = Object.values(config.weights).reduce((sum, value) => sum + value, 0);

  return (
    <form action={formAction} className="space-y-6">
      <section>
        <h3 className="text-sm font-semibold text-ink-900">Match Score の重み</h3>
        <p className="mt-0.5 text-xs text-ink-500">現在の合計: {weightTotal}（100を推奨）</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label="Skill Match">
            <Input name="weight_skill" type="number" step="1" defaultValue={config.weights.skill} />
          </Field>
          <Field label="Certification Match">
            <Input name="weight_certification" type="number" step="1" defaultValue={config.weights.certification} />
          </Field>
          <Field label="Experience Match">
            <Input name="weight_experience" type="number" step="1" defaultValue={config.weights.experience} />
          </Field>
          <Field label="Location Match">
            <Input name="weight_location" type="number" step="1" defaultValue={config.weights.location} />
          </Field>
          <Field label="Working Condition">
            <Input
              name="weight_workingCondition"
              type="number"
              step="1"
              defaultValue={config.weights.workingCondition}
            />
          </Field>
          <Field label="Education / Management">
            <Input
              name="weight_educationManagement"
              type="number"
              step="1"
              defaultValue={config.weights.educationManagement}
            />
          </Field>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-ink-900">ランク判定</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label="S 下限" hint="非常に高い">
            <Input name="rank_S" type="number" step="1" defaultValue={config.rankThresholds.S} />
          </Field>
          <Field label="A 下限" hint="高い">
            <Input name="rank_A" type="number" step="1" defaultValue={config.rankThresholds.A} />
          </Field>
          <Field label="B 下限" hint="可能性あり">
            <Input name="rank_B" type="number" step="1" defaultValue={config.rankThresholds.B} />
          </Field>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-ink-900">職種候補と年収レンジ</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label="遷移ルールの反映率" hint="0〜1。base_transition_score の比重">
            <Input
              name="transitionAffinityWeight"
              type="number"
              step="0.05"
              min="0"
              max="1"
              defaultValue={config.transitionAffinityWeight}
            />
          </Field>
          <Field label="候補に残す最低スコア">
            <Input name="minMatchScore" type="number" step="1" defaultValue={config.minMatchScore} />
          </Field>
          <Field label="年収の丸め単位（円）" hint="例: 100000 = 10万円単位">
            <Input name="salaryRoundingUnit" type="number" step="10000" defaultValue={config.salaryRoundingUnit} />
          </Field>
          <Field label="最小表示件数">
            <Input name="minOptionsShown" type="number" step="1" defaultValue={config.minOptionsShown} />
          </Field>
          <Field label="最大表示件数">
            <Input name="maxOptionsShown" type="number" step="1" defaultValue={config.maxOptionsShown} />
          </Field>
          <Field label="経験加点の上限年数">
            <Input
              name="experienceFullBonusYears"
              type="number"
              step="1"
              defaultValue={config.experienceFullBonusYears}
            />
          </Field>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-ink-900">市場価値スコアの構成</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label="適合度の比重" hint="0〜1">
            <Input name="mv_matchWeight" type="number" step="0.05" defaultValue={config.marketValue.matchWeight} />
          </Field>
          <Field label="年収伸びしろの比重" hint="0〜1">
            <Input name="mv_upsideWeight" type="number" step="0.05" defaultValue={config.marketValue.upsideWeight} />
          </Field>
          <Field label="満点となる伸びしろ（円）">
            <Input name="mv_upsideFullJpy" type="number" step="100000" defaultValue={config.marketValue.upsideFullJpy} />
          </Field>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-ink-900">学歴スコア（0〜1）</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {(
            [
              ['edu_high_school', '高校卒', config.educationScores.high_school],
              ['edu_vocational', '専門学校卒', config.educationScores.vocational],
              ['edu_associate', '短大・高専卒', config.educationScores.associate],
              ['edu_bachelor', '大学卒', config.educationScores.bachelor],
              ['edu_master', '大学院卒', config.educationScores.master],
              ['edu_other', 'その他', config.educationScores.other],
            ] as const
          ).map(([name, label, value]) => (
            <Field key={name} label={label}>
              <Input name={name} type="number" step="0.05" min="0" max="1" defaultValue={value} />
            </Field>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-ink-900">有望候補者（Qualified）の判定</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="市場価値スコアの下限">
            <Input name="qualifiedMinScore" type="number" step="1" defaultValue={config.qualifiedMinScore} />
          </Field>
          <Field label="年収伸びしろの下限（円）">
            <Input
              name="qualifiedMinUpsideJpy"
              type="number"
              step="50000"
              defaultValue={config.qualifiedMinUpsideJpy}
            />
          </Field>
        </div>
      </section>

      <Result state={state} />
      <SubmitButton pendingLabel="保存中...">診断設定を保存</SubmitButton>
    </form>
  );
}

export function AnalyticsConfigForm({ config }: { config: AnalyticsConfig }) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveAnalyticsConfigAction, {});

  return (
    <form action={formAction} className="space-y-6">
      <section>
        <h3 className="text-sm font-semibold text-ink-900">Area Score の重み</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {(
            [
              ['as_approachesPerHour', '声掛け/h', config.areaScoreWeights.approachesPerHour],
              ['as_stopRate', '立ち止まり率', config.areaScoreWeights.stopRate],
              ['as_scanRate', 'QR率', config.areaScoreWeights.scanRate],
              ['as_diagnosisCompletionRate', '診断完了率', config.areaScoreWeights.diagnosisCompletionRate],
              ['as_leadRate', 'リード率', config.areaScoreWeights.leadRate],
              ['as_interviewRate', '面談率', config.areaScoreWeights.interviewRate],
              ['as_qualifiedRate', '有望率', config.areaScoreWeights.qualifiedRate],
              ['as_referralRate', '送客率', config.areaScoreWeights.referralRate],
              ['as_grossProfitPerSalesHour', '粗利/h', config.areaScoreWeights.grossProfitPerSalesHour],
            ] as const
          ).map(([name, label, value]) => (
            <Field key={name} label={label}>
              <Input name={name} type="number" step="0.5" min="0" defaultValue={value} />
            </Field>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-ink-900">正規化の上限値とランク</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label="声掛け/h の満点">
            <Input
              name="ceil_approachesPerHour"
              type="number"
              step="1"
              defaultValue={config.areaScoreCeilings.approachesPerHour}
            />
          </Field>
          <Field label="粗利/h の満点（円）">
            <Input
              name="ceil_grossProfitPerSalesHour"
              type="number"
              step="500"
              defaultValue={config.areaScoreCeilings.grossProfitPerSalesHour}
            />
          </Field>
          <div />
          <Field label="S 下限">
            <Input name="ar_S" type="number" step="1" defaultValue={config.areaScoreRankThresholds.S} />
          </Field>
          <Field label="A 下限">
            <Input name="ar_A" type="number" step="1" defaultValue={config.areaScoreRankThresholds.A} />
          </Field>
          <Field label="B 下限">
            <Input name="ar_B" type="number" step="1" defaultValue={config.areaScoreRankThresholds.B} />
          </Field>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-ink-900">原価前提とサンプル数の閾値</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="営業時給（円/h）">
            <Input
              name="salesBaseHourlyWageJpy"
              type="number"
              step="50"
              defaultValue={config.salesBaseHourlyWageJpy}
            />
          </Field>
          <Field label="その他獲得コスト（円/h）" hint="交通費・備品・場所使用料など">
            <Input
              name="otherCostPerSalesHourJpy"
              type="number"
              step="50"
              defaultValue={config.otherCostPerSalesHourJpy}
            />
          </Field>
          <Field label="低サンプル判定: 稼働時間">
            <Input name="lowSampleSalesHours" type="number" step="1" defaultValue={config.lowSampleSalesHours} />
          </Field>
          <Field label="低サンプル判定: 声掛け数">
            <Input name="lowSampleApproaches" type="number" step="10" defaultValue={config.lowSampleApproaches} />
          </Field>
        </div>
      </section>

      <Field label="時間帯定義（JSON）" hint='例: [{"label":"午後 (13-16)","startHour":13,"endHour":16}]'>
        <textarea
          name="timeBands"
          rows={5}
          defaultValue={JSON.stringify(config.timeBands, null, 0)}
          className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-mono text-xs"
        />
      </Field>

      <Result state={state} />
      <SubmitButton pendingLabel="保存中...">分析設定を保存</SubmitButton>
    </form>
  );
}
