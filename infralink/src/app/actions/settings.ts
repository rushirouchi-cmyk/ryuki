'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { assertCan } from '@/lib/rbac';
import { writeAudit } from '@/lib/audit';
import {
  getBdWeights,
  getEscalationSettings,
  getMatchWeights,
  getScheduleSettings,
  getSlaSettings,
  setSetting,
  SETTING_KEYS,
  type BdWeights,
  type MatchWeights,
} from '@/lib/settings';
import { syncFromDataSource } from '@/lib/sync';
import { runCandidateMonitor, runEscalationSweep } from '@/lib/agents/ca-supervisor';
import { refreshAllMatches } from '@/lib/agents/matching';
import { runWeeklyMarketResearch } from '@/lib/agents/market-research';
import { runBusinessDevelopmentRanking } from '@/lib/agents/business-development';
import { sendDailyReport, sendWeeklyBdReport } from '@/lib/agents/reports';

/** マッチング重みの更新 (§11)。合計 100 に正規化はせず、入力値をそのまま配点として扱う。 */
export async function updateMatchWeightsAction(formData: FormData) {
  const user = await requireUser();
  assertCan(user, 'settings:write');
  const before = await getMatchWeights();
  const next = { ...before };
  for (const key of Object.keys(before) as (keyof MatchWeights)[]) {
    const value = Number(formData.get(key));
    if (Number.isFinite(value) && value >= 0) next[key] = value;
  }
  await setSetting(SETTING_KEYS.matchWeights, next, user.id);
  await writeAudit({ actor: { type: 'human', id: user.id, label: user.name }, entityType: 'settings', entityId: SETTING_KEYS.matchWeights, action: 'update', before, after: next });
  revalidatePath('/admin/settings');
  return { ok: true };
}

/** 新規開拓スコア重みの更新 (§18)。 */
export async function updateBdWeightsAction(formData: FormData) {
  const user = await requireUser();
  assertCan(user, 'settings:write');
  const before = await getBdWeights();
  const next = { ...before };
  for (const key of Object.keys(before) as (keyof BdWeights)[]) {
    const value = Number(formData.get(key));
    if (Number.isFinite(value) && value >= 0) next[key] = value;
  }
  await setSetting(SETTING_KEYS.bdWeights, next, user.id);
  await writeAudit({ actor: { type: 'human', id: user.id, label: user.name }, entityType: 'settings', entityId: SETTING_KEYS.bdWeights, action: 'update', before, after: next });
  revalidatePath('/admin/settings');
  return { ok: true };
}

/** SLA 時間の更新 (§6)。フェーズ×チェック種別ごとの時間とレベルを変更できる。 */
export async function updateSlaAction(formData: FormData) {
  const user = await requireUser();
  assertCan(user, 'settings:write');
  const before = await getSlaSettings();
  const next = structuredClone(before);

  const warnRatio = Number(formData.get('warnRatio'));
  if (Number.isFinite(warnRatio) && warnRatio > 0 && warnRatio <= 1) next.warnRatio = warnRatio;

  for (const [phase, rules] of Object.entries(next.rules)) {
    for (const rule of rules) {
      const hours = Number(formData.get(`hours:${phase}:${rule.alertType}`));
      if (Number.isFinite(hours) && hours >= 0) rule.hours = hours;
      const level = Number(formData.get(`level:${phase}:${rule.alertType}`));
      if ([1, 2, 3].includes(level)) rule.level = level as 1 | 2 | 3;
    }
  }

  await setSetting(SETTING_KEYS.sla, next, user.id);
  await writeAudit({ actor: { type: 'human', id: user.id, label: user.name }, entityType: 'settings', entityId: SETTING_KEYS.sla, action: 'update', before, after: next });
  revalidatePath('/admin/settings');
  return { ok: true };
}

/** エスカレーション設定 (§9) と定期実行時刻 (§52) の更新。 */
export async function updateOperationsAction(formData: FormData) {
  const user = await requireUser();
  assertCan(user, 'settings:write');

  const escalationBefore = await getEscalationSettings();
  const escalation = {
    firstReminderHours: Number(formData.get('firstReminderHours')) || escalationBefore.firstReminderHours,
    escalationHours: Number(formData.get('escalationHours')) || escalationBefore.escalationHours,
    notifyExecutiveOnCritical: formData.get('notifyExecutiveOnCritical') === 'on',
  };
  await setSetting(SETTING_KEYS.escalation, escalation, user.id);

  const scheduleBefore = await getScheduleSettings();
  const schedule = {
    morningMonitor: String(formData.get('morningMonitor') || scheduleBefore.morningMonitor),
    eveningRecheck: String(formData.get('eveningRecheck') || scheduleBefore.eveningRecheck),
    executiveReport: String(formData.get('executiveReport') || scheduleBefore.executiveReport),
    weeklyMarketResearch: String(formData.get('weeklyMarketResearch') || scheduleBefore.weeklyMarketResearch),
    weeklyBdRanking: String(formData.get('weeklyBdRanking') || scheduleBefore.weeklyBdRanking),
  };
  await setSetting(SETTING_KEYS.schedule, schedule, user.id);

  await writeAudit({
    actor: { type: 'human', id: user.id, label: user.name },
    entityType: 'settings',
    entityId: 'operations',
    action: 'update',
    before: { escalation: escalationBefore, schedule: scheduleBefore },
    after: { escalation, schedule },
  });
  revalidatePath('/admin/settings');
  return { ok: true };
}

/** 定期ジョブを手動実行する (§52)。実行結果は job_run_logs に残す。 */
export type JobName =
  | 'sync'
  | 'monitor'
  | 'escalation'
  | 'matching'
  | 'market_research'
  | 'bd_ranking'
  | 'daily_report'
  | 'weekly_bd_report';

export async function runJob(name: JobName) {
  const log = await prisma.jobRunLog.create({ data: { jobName: name } });
  try {
    let summary = '';
    switch (name) {
      case 'sync': {
        const r = await syncFromDataSource();
        summary = `source=${r.source} 企業${r.companies} 求人${r.jobs} 候補者${r.candidates}`;
        break;
      }
      case 'monitor': {
        const r = await runCandidateMonitor();
        summary = `${r.candidatesChecked}名確認 / 新規${r.alertsCreated}件 / 解消${r.alertsResolved}件 / 重大${r.criticalCount}件`;
        break;
      }
      case 'escalation': {
        const r = await runEscalationSweep();
        summary = `再通知${r.reminded}件 / エスカレーション${r.escalated}件`;
        break;
      }
      case 'matching': {
        const r = await refreshAllMatches();
        summary = `候補者${r.candidates}名 / マッチ${r.matches}件`;
        break;
      }
      case 'market_research': {
        const r = await runWeeklyMarketResearch();
        summary = `候補者${r.candidates}名 / 求人情報${r.findings}件 / 未取引企業${r.newProspectCompanies}社`;
        break;
      }
      case 'bd_ranking': {
        const r = await runBusinessDevelopmentRanking();
        summary = `${r.evaluated}社を評価`;
        break;
      }
      case 'daily_report': {
        const r = await sendDailyReport();
        summary = `稼働${r.activeCandidates}名 / 重大${r.critical}件`;
        break;
      }
      case 'weekly_bd_report': {
        const r = await sendWeeklyBdReport();
        summary = `上位${r.rows.length}社 / 今週の未取引企業${r.newProspectCount}社`;
        break;
      }
    }
    await prisma.jobRunLog.update({
      where: { id: log.id },
      data: { status: 'success', summary, finishedAt: new Date() },
    });
    return { ok: true, summary };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.jobRunLog.update({
      where: { id: log.id },
      data: { status: 'failed', error: message, finishedAt: new Date() },
    });
    return { ok: false, summary: message };
  }
}

export async function runJobAction(formData: FormData) {
  const user = await requireUser();
  assertCan(user, 'settings:write');
  const name = String(formData.get('job') ?? '') as JobName;
  const result = await runJob(name);
  revalidatePath('/admin/settings');
  return result;
}
