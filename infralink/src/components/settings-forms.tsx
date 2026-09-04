'use client';

import { useState, useTransition } from 'react';
import {
  runJobAction,
  updateBdWeightsAction,
  updateMatchWeightsAction,
  updateOperationsAction,
  updateSlaAction,
} from '@/app/actions/settings';
import { ALERT_TYPE_LABELS, PHASE_LABELS, type AlertType, type CandidatePhase } from '@/lib/domain/enums';

function SubmitBar({ pending, message }: { pending: boolean; message: string | null }) {
  return (
    <div className="mt-3 flex items-center gap-2 border-t border-[var(--border)] pt-3">
      <button
        disabled={pending}
        className="rounded border border-[var(--accent)] bg-[var(--accent)] px-2.5 py-1 text-xs text-white disabled:opacity-50"
      >
        {pending ? '保存中...' : '保存'}
      </button>
      {message && <span className="text-xxs text-[var(--text-muted)]">{message}</span>}
    </div>
  );
}

export function WeightsForm({
  weights,
  labels,
  kind,
}: {
  weights: Record<string, number>;
  labels: Record<string, string>;
  kind: 'match' | 'bd';
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const total = Object.values(weights).reduce((a, b) => a + b, 0);

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          const res = kind === 'match' ? await updateMatchWeightsAction(formData) : await updateBdWeightsAction(formData);
          setMessage(res.ok ? '保存しました。次回スコア計算から反映されます。' : 'エラーが発生しました');
        })
      }
    >
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {Object.entries(weights).map(([key, value]) => (
          <label key={key} className="block">
            <span className="text-xxs text-[var(--text-muted)]">{labels[key] ?? key}</span>
            <input
              type="number"
              name={key}
              defaultValue={value}
              min={0}
              className="mt-0.5 w-full rounded border border-[var(--border)] px-1.5 py-1 text-xs"
            />
          </label>
        ))}
      </div>
      <p className="mt-2 text-xxs text-[var(--text-muted)]">現在の合計: {total} 点</p>
      <SubmitBar pending={pending} message={message} />
    </form>
  );
}

export function SlaForm({
  warnRatio,
  rules,
}: {
  warnRatio: number;
  rules: Record<string, { alertType: string; hours: number; level: number; label: string; businessDays: boolean }[]>;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          const res = await updateSlaAction(formData);
          setMessage(res.ok ? '保存しました。次回の監視から反映されます。' : 'エラーが発生しました');
        })
      }
    >
      <label className="mb-3 block max-w-xs">
        <span className="text-xxs text-[var(--text-muted)]">
          Level 1 (注意) を出す割合 — 期限のこの割合を過ぎたら注意
        </span>
        <input
          type="number"
          name="warnRatio"
          step="0.05"
          min="0.1"
          max="1"
          defaultValue={warnRatio}
          className="mt-0.5 w-full rounded border border-[var(--border)] px-1.5 py-1 text-xs"
        />
      </label>

      <div className="space-y-2">
        {Object.entries(rules).map(([phase, phaseRules]) =>
          phaseRules.length === 0 ? null : (
            <div key={phase} className="rounded border border-[var(--border)] p-2">
              <h4 className="text-xs font-semibold">{PHASE_LABELS[phase as CandidatePhase] ?? phase}</h4>
              {phaseRules.map((rule) => (
                <div key={rule.alertType} className="mt-1.5 grid grid-cols-1 gap-2 md:grid-cols-4">
                  <div className="md:col-span-2">
                    <p className="text-xs">{ALERT_TYPE_LABELS[rule.alertType as AlertType] ?? rule.alertType}</p>
                    <p className="text-xxs text-[var(--text-muted)]">{rule.label}</p>
                  </div>
                  <label className="block">
                    <span className="text-xxs text-[var(--text-muted)]">
                      期限{rule.businessDays ? '（営業日換算）' : '（時間）'}
                    </span>
                    <input
                      type="number"
                      name={`hours:${phase}:${rule.alertType}`}
                      defaultValue={rule.hours}
                      min={0}
                      className="mt-0.5 w-full rounded border border-[var(--border)] px-1.5 py-1 text-xs"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xxs text-[var(--text-muted)]">超過時のレベル</span>
                    <select
                      name={`level:${phase}:${rule.alertType}`}
                      defaultValue={rule.level}
                      className="mt-0.5 w-full rounded border border-[var(--border)] px-1.5 py-1 text-xs"
                    >
                      <option value={1}>Lv1 注意</option>
                      <option value={2}>Lv2 遅延</option>
                      <option value={3}>Lv3 重大</option>
                    </select>
                  </label>
                </div>
              ))}
            </div>
          ),
        )}
      </div>
      <SubmitBar pending={pending} message={message} />
    </form>
  );
}

export function OperationsForm({
  escalation,
  schedule,
}: {
  escalation: { firstReminderHours: number; escalationHours: number; notifyExecutiveOnCritical: boolean };
  schedule: Record<string, string>;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const scheduleLabels: Record<string, string> = {
    morningMonitor: '毎朝: 候補者監視',
    eveningRecheck: '毎夕: 未対応再確認',
    executiveReport: '毎日: Executive Report',
    weeklyMarketResearch: '毎週: Market Research (曜日:時刻)',
    weeklyBdRanking: '毎週: BD Ranking (曜日:時刻)',
  };

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          const res = await updateOperationsAction(formData);
          setMessage(res.ok ? '保存しました。' : 'エラーが発生しました');
        })
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <h4 className="text-xs font-semibold">エスカレーション (§9)</h4>
          <label className="mt-1 block">
            <span className="text-xxs text-[var(--text-muted)]">AI確認から再通知までの時間 (h)</span>
            <input type="number" name="firstReminderHours" defaultValue={escalation.firstReminderHours} min={1}
              className="mt-0.5 w-full rounded border border-[var(--border)] px-1.5 py-1 text-xs" />
          </label>
          <label className="mt-1 block">
            <span className="text-xxs text-[var(--text-muted)]">再通知から経営者エスカレーションまでの時間 (h)</span>
            <input type="number" name="escalationHours" defaultValue={escalation.escalationHours} min={1}
              className="mt-0.5 w-full rounded border border-[var(--border)] px-1.5 py-1 text-xs" />
          </label>
          <label className="mt-2 flex items-center gap-1.5 text-xs">
            <input type="checkbox" name="notifyExecutiveOnCritical" defaultChecked={escalation.notifyExecutiveOnCritical} />
            重大 (Lv3) を経営者へ即時通知する
          </label>
        </div>

        <div>
          <h4 className="text-xs font-semibold">定期実行時刻 (§52)</h4>
          {Object.entries(schedule).map(([key, value]) => (
            <label key={key} className="mt-1 block">
              <span className="text-xxs text-[var(--text-muted)]">{scheduleLabels[key] ?? key}</span>
              <input name={key} defaultValue={value}
                className="mt-0.5 w-full rounded border border-[var(--border)] px-1.5 py-1 text-xs" />
            </label>
          ))}
        </div>
      </div>
      <SubmitBar pending={pending} message={message} />
    </form>
  );
}

const JOBS: { name: string; label: string; description: string }[] = [
  { name: 'sync', label: 'データソース同期', description: 'PORTERS / Sheets / Mock から取り込む' },
  { name: 'monitor', label: '候補者監視 (Agent 01)', description: 'SLA を評価しアラートを生成' },
  { name: 'escalation', label: '未対応再確認', description: '再通知とエスカレーション' },
  { name: 'matching', label: '求人マッチング (Agent 02)', description: '全候補者のスコアを再計算' },
  { name: 'market_research', label: 'WEB市場調査 (Agent 03)', description: 'S/Aランク候補者で企業探索' },
  { name: 'bd_ranking', label: '新規開拓ランキング (Agent 04)', description: '開拓優先度を再評価' },
  { name: 'daily_report', label: '日次レポート送信', description: '経営者へ日次レポートを送信' },
  { name: 'weekly_bd_report', label: '週次BDレポート送信', description: '経営者・RA へ週次レポートを送信' },
];

export function JobRunner() {
  const [pending, startTransition] = useTransition();
  const [results, setResults] = useState<Record<string, string>>({});

  return (
    <div className="grid gap-2 md:grid-cols-2">
      {JOBS.map((job) => (
        <form
          key={job.name}
          className="flex items-start justify-between gap-2 rounded border border-[var(--border)] p-2"
          action={(formData) =>
            startTransition(async () => {
              const res = await runJobAction(formData);
              setResults((prev) => ({ ...prev, [job.name]: res.summary || (res.ok ? '完了' : '失敗') }));
            })
          }
        >
          <input type="hidden" name="job" value={job.name} />
          <div className="min-w-0">
            <p className="text-xs font-medium">{job.label}</p>
            <p className="text-xxs text-[var(--text-muted)]">{job.description}</p>
            {results[job.name] && <p className="mt-0.5 text-xxs text-done-fg">{results[job.name]}</p>}
          </div>
          <button
            disabled={pending}
            className="shrink-0 rounded border border-[var(--border)] px-2 py-1 text-xxs hover:bg-[var(--bg-subtle)] disabled:opacity-50"
          >
            実行
          </button>
        </form>
      ))}
    </div>
  );
}
