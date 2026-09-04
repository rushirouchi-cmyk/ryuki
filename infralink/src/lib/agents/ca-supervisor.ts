import { prisma } from '@/lib/db';
import { writeAudit } from '@/lib/audit';
import { notify } from '@/lib/adapters/notification';
import { getEscalationSettings, getSlaSettings } from '@/lib/settings';
import { evaluateSla, type SlaContext } from '@/lib/domain/sla';
import { ALERT_LEVEL_LABELS, ALERT_TYPE_LABELS, CA_RESPONSE_CHOICES, PHASE_LABELS } from '@/lib/domain/enums';
import type { AlertLevel, CandidatePhase } from '@/lib/domain/enums';
import { formatDate, hoursBetween } from '@/lib/domain/dates';

/**
 * Agent 01: CA Supervisor Agent (§5/§6/§7/§8/§9)。
 *
 * 毎日候補者の進捗を監視し、フェーズ別 SLA の超過を検出して
 *   1) アラート生成
 *   2) 担当 CA への AI 状況確認
 *   3) 未回答なら再通知 → 経営者へエスカレーション
 * を行う。経営者へいきなり通知しないのが原則 (§8)。
 */

export type MonitorSummary = {
  candidatesChecked: number;
  alertsCreated: number;
  alertsResolved: number;
  criticalCount: number;
  notifiedCas: number;
};

/** 候補者の SLA を評価し、アラートを同期する (作成 / 解消)。 */
export async function runCandidateMonitor(): Promise<MonitorSummary> {
  const now = new Date();
  const settings = await getSlaSettings();
  const escalation = await getEscalationSettings();

  const candidates = await prisma.candidate.findMany({
    where: { status: 'active' },
    include: {
      actions: { orderBy: { actionDate: 'desc' }, take: 50 },
      applications: true,
      ownerCa: true,
      alerts: { where: { status: { in: ['open', 'answered', 'escalated'] } } },
    },
  });

  let alertsCreated = 0;
  let alertsResolved = 0;
  let criticalCount = 0;
  const caIds = new Set<string>();

  for (const candidate of candidates) {
    const ctx: SlaContext = {
      candidate: {
        id: candidate.id,
        name: candidate.name,
        phase: candidate.phase,
        rank: candidate.rank,
        ownerCaId: candidate.ownerCaId,
        createdAt: candidate.createdAt,
        lastContactDate: candidate.lastContactDate,
        nextAction: candidate.nextAction,
        nextActionDate: candidate.nextActionDate,
      },
      actions: candidate.actions.map((a) => ({ actionType: a.actionType, actionDate: a.actionDate })),
      applications: candidate.applications.map((a) => ({
        currentStage: a.currentStage,
        applicationDate: a.applicationDate,
        documentResult: a.documentResult,
        offerDeadline: a.offerDeadline,
      })),
      now,
    };

    const findings = evaluateSla(ctx, settings);
    const foundTypes = new Set(findings.map((f) => f.alertType));

    // --- 解消: 既存アラートのうち、今回検出されなくなったものを閉じる
    for (const alert of candidate.alerts) {
      if (alert.alertType === 'ca_no_response') continue; // 別ロジックで管理
      if (!foundTypes.has(alert.alertType as never)) {
        await prisma.aiAlert.update({
          where: { id: alert.id },
          data: { status: 'resolved', resolvedAt: now },
        });
        await writeAudit({
          actor: { type: 'AI', label: 'CA Supervisor Agent' },
          entityType: 'ai_alert',
          entityId: alert.id,
          action: 'update',
          before: { status: alert.status },
          after: { status: 'resolved' },
        });
        alertsResolved += 1;
      }
    }

    // --- 生成 / 更新
    for (const finding of findings) {
      const existing = candidate.alerts.find(
        (a) => a.alertType === finding.alertType && ['open', 'answered', 'escalated'].includes(a.status),
      );

      if (existing) {
        if (existing.alertLevel !== finding.level) {
          await prisma.aiAlert.update({
            where: { id: existing.id },
            data: { alertLevel: finding.level, reason: finding.reason, dueAt: finding.dueAt },
          });
        }
        if (finding.level === 3) criticalCount += 1;
        continue;
      }

      const created = await prisma.aiAlert.create({
        data: {
          candidateId: candidate.id,
          caId: candidate.ownerCaId,
          alertLevel: finding.level,
          alertType: finding.alertType,
          reason: finding.reason,
          dueAt: finding.dueAt,
          detectedAt: now,
          status: 'open',
        },
      });
      alertsCreated += 1;
      if (finding.level === 3) criticalCount += 1;
      if (candidate.ownerCaId) caIds.add(candidate.ownerCaId);

      await writeAudit({
        actor: { type: 'AI', label: 'CA Supervisor Agent' },
        entityType: 'ai_alert',
        entityId: created.id,
        action: 'create',
        after: { alertType: finding.alertType, level: finding.level, reason: finding.reason },
      });

      // Level 2 以上は担当 CA へ AI 確認を送る (§8)。
      if (finding.level >= 2 && candidate.ownerCa) {
        await sendCaInquiry({
          alertId: created.id,
          candidateName: candidate.name,
          candidateId: candidate.id,
          phase: candidate.phase as CandidatePhase,
          dueAt: finding.dueAt,
          reason: finding.reason,
          caEmail: candidate.ownerCa.email,
          caId: candidate.ownerCa.id,
        });
      }

      // Level 3 は経営者へ即時通知 (§7)。
      if (finding.level === 3 && escalation.notifyExecutiveOnCritical) {
        await notifyExecutives({
          subject: `【重大】${candidate.name} — ${ALERT_TYPE_LABELS[finding.alertType]}`,
          body: [
            `候補者: ${candidate.name} (${PHASE_LABELS[candidate.phase as CandidatePhase] ?? candidate.phase})`,
            `担当CA: ${candidate.ownerCa?.name ?? '未割当'}`,
            `内容: ${finding.reason}`,
            `期限: ${formatDate(finding.dueAt)} (超過 ${Math.round(finding.overdueHours)}時間)`,
          ].join('\n'),
          refId: created.id,
        });
      }
    }
  }

  return {
    candidatesChecked: candidates.length,
    alertsCreated,
    alertsResolved,
    criticalCount,
    notifiedCas: caIds.size,
  };
}

/** CA への AI 状況確認メッセージ (§8)。選択肢と自由記述の両方を提示する。 */
export function buildCaInquiry(params: {
  candidateName: string;
  dueAt: Date;
  reason: string;
}) {
  return [
    `${params.candidateName}様について、${formatDate(params.dueAt)}が対応予定日でしたが進捗の更新がありません。`,
    `検知内容: ${params.reason}`,
    '',
    '現在の状況を教えてください。',
    ...CA_RESPONSE_CHOICES.map((c, i) => `${i + 1}. ${c.label}`),
    '',
    '自由記述でも構いません (例:「昨日電話しましたが出なかったため、明日再度電話します。」)',
  ].join('\n');
}

async function sendCaInquiry(params: {
  alertId: string;
  candidateId: string;
  candidateName: string;
  phase: CandidatePhase;
  dueAt: Date;
  reason: string;
  caEmail: string;
  caId: string;
}) {
  const question = buildCaInquiry(params);

  await prisma.aiInteraction.create({
    data: {
      agentType: 'ca_supervisor',
      candidateId: params.candidateId,
      userId: params.caId,
      alertId: params.alertId,
      question,
    },
  });

  await prisma.aiAlert.update({
    where: { id: params.alertId },
    data: { firstNotificationAt: new Date() },
  });

  await notify({
    to: params.caEmail,
    subject: `【要確認】${params.candidateName}様の進捗について`,
    body: question,
    refType: 'ai_alert',
    refId: params.alertId,
  });
}

async function notifyExecutives(params: { subject: string; body: string; refId: string }) {
  const executives = await prisma.user.findMany({
    where: { role: { in: ['executive', 'admin'] }, active: true },
  });
  for (const exec of executives) {
    await notify({
      to: exec.email,
      subject: params.subject,
      body: params.body,
      refType: 'ai_alert',
      refId: params.refId,
    });
  }
}

/**
 * 未回答アラートの再通知 / エスカレーション (§9)。
 * 期限超過 → CA 確認 → 一定時間未回答 → 再通知 → さらに未回答 → 経営者。
 */
export async function runEscalationSweep() {
  const now = new Date();
  const settings = await getEscalationSettings();

  const alerts = await prisma.aiAlert.findMany({
    where: { status: 'open', firstNotificationAt: { not: null } },
    include: { candidate: true, ca: true },
  });

  let reminded = 0;
  let escalated = 0;

  for (const alert of alerts) {
    if (!alert.firstNotificationAt) continue;

    const sinceFirst = hoursBetween(alert.firstNotificationAt, now);

    // 再通知
    if (!alert.secondNotificationAt && sinceFirst >= settings.firstReminderHours) {
      if (alert.ca) {
        await notify({
          to: alert.ca.email,
          subject: `【再通知】${alert.candidate?.name ?? ''}様の進捗確認`,
          body: [
            `先ほどの確認にご回答がないため再度ご連絡します。`,
            `内容: ${alert.reason}`,
            `${settings.escalationHours}時間以内に回答がない場合、経営層へエスカレーションされます。`,
          ].join('\n'),
          refType: 'ai_alert',
          refId: alert.id,
        });
      }
      await prisma.aiAlert.update({
        where: { id: alert.id },
        data: { secondNotificationAt: now },
      });
      reminded += 1;
      continue;
    }

    // エスカレーション
    if (
      alert.secondNotificationAt &&
      !alert.escalatedAt &&
      hoursBetween(alert.secondNotificationAt, now) >= settings.escalationHours
    ) {
      await prisma.aiAlert.update({
        where: { id: alert.id },
        data: { escalatedAt: now, status: 'escalated', alertLevel: 3 },
      });
      // CA 未回答そのものを重大アラートとして可視化する (§7)。
      await prisma.aiAlert.upsert({
        where: {
          candidateId_alertType_status: {
            candidateId: alert.candidateId ?? '',
            alertType: 'ca_no_response',
            status: 'open',
          },
        },
        create: {
          candidateId: alert.candidateId,
          caId: alert.caId,
          alertLevel: 3,
          alertType: 'ca_no_response',
          reason: `AI からの状況確認に ${settings.escalationHours} 時間以上回答がありません`,
          status: 'open',
          escalatedAt: now,
        },
        update: { escalatedAt: now, alertLevel: 3 },
      });

      await notifyExecutives({
        subject: `【エスカレーション】${alert.candidate?.name ?? ''}様 — CA未回答`,
        body: [
          `候補者: ${alert.candidate?.name ?? ''}`,
          `担当CA: ${alert.ca?.name ?? '未割当'}`,
          `内容: ${alert.reason}`,
          `AI 確認: ${formatDate(alert.firstNotificationAt)} / 再通知: ${formatDate(alert.secondNotificationAt)}`,
          `レベル: ${ALERT_LEVEL_LABELS[3 as AlertLevel]}`,
        ].join('\n'),
        refId: alert.id,
      });

      await writeAudit({
        actor: { type: 'AI', label: 'CA Supervisor Agent' },
        entityType: 'ai_alert',
        entityId: alert.id,
        action: 'escalate',
        after: { escalatedAt: now },
      });
      escalated += 1;
    }
  }

  return { reminded, escalated };
}
