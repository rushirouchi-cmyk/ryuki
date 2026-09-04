import { prisma } from '@/lib/db';
import { ALERT_TYPE_LABELS, PHASE_LABELS, type AlertLevel, type AlertType, type CandidatePhase } from '@/lib/domain/enums';
import { describeDue, startOfDay } from '@/lib/domain/dates';

/**
 * 「今日やるべきこと」の組み立て (§25/§53)。
 *
 * 画面を開いた瞬間に 優先順位 / 期限 / リスク が分かることを最優先にする。
 * 並び順: アラートレベル降順 → 超過日数降順 → 期限昇順。
 */

export type TodoItem = {
  candidateId: string;
  candidateName: string;
  phase: CandidatePhase;
  phaseLabel: string;
  caName: string | null;
  /** アラート由来なら level、次回アクションのみなら 0。 */
  level: AlertLevel | 0;
  alertId: string | null;
  alertType: AlertType | null;
  title: string;
  reason: string | null;
  dueAt: Date | null;
  dueLabel: string;
  overdueDays: number;
  awaitingCaResponse: boolean;
};

export async function buildTodoList(options: { caId?: string; limit?: number } = {}): Promise<TodoItem[]> {
  const { caId, limit = 100 } = options;
  const now = new Date();
  const todayEnd = new Date(startOfDay(now).getTime() + 86_400_000);

  const [alerts, candidates] = await Promise.all([
    prisma.aiAlert.findMany({
      where: {
        status: { in: ['open', 'escalated'] },
        ...(caId ? { caId } : {}),
      },
      include: { candidate: { include: { ownerCa: true } } },
    }),
    // アラートは出ていないが本日期限の次回アクションも「やること」に含める。
    prisma.candidate.findMany({
      where: {
        status: 'active',
        ...(caId ? { ownerCaId: caId } : {}),
        nextActionDate: { not: null, lt: todayEnd },
      },
      include: { ownerCa: true },
    }),
  ]);

  const items: TodoItem[] = [];
  const seenCandidateAlertless = new Set<string>();

  for (const alert of alerts) {
    if (!alert.candidate) continue;
    const due = describeDue(alert.dueAt, now);
    items.push({
      candidateId: alert.candidate.id,
      candidateName: alert.candidate.name,
      phase: alert.candidate.phase as CandidatePhase,
      phaseLabel: PHASE_LABELS[alert.candidate.phase as CandidatePhase] ?? alert.candidate.phase,
      caName: alert.candidate.ownerCa?.name ?? null,
      level: alert.alertLevel as AlertLevel,
      alertId: alert.id,
      alertType: alert.alertType as AlertType,
      title: ALERT_TYPE_LABELS[alert.alertType as AlertType] ?? alert.alertType,
      reason: alert.reason,
      dueAt: alert.dueAt,
      dueLabel: due.label,
      overdueDays: due.overdueDays,
      awaitingCaResponse: Boolean(alert.firstNotificationAt) && alert.status === 'open',
    });
    seenCandidateAlertless.add(alert.candidate.id);
  }

  for (const candidate of candidates) {
    if (seenCandidateAlertless.has(candidate.id)) continue;
    const due = describeDue(candidate.nextActionDate, now);
    items.push({
      candidateId: candidate.id,
      candidateName: candidate.name,
      phase: candidate.phase as CandidatePhase,
      phaseLabel: PHASE_LABELS[candidate.phase as CandidatePhase] ?? candidate.phase,
      caName: candidate.ownerCa?.name ?? null,
      level: 0,
      alertId: null,
      alertType: null,
      title: candidate.nextAction ?? '次回アクション',
      reason: null,
      dueAt: candidate.nextActionDate,
      dueLabel: due.label,
      overdueDays: due.overdueDays,
      awaitingCaResponse: false,
    });
  }

  return items
    .sort(
      (a, b) =>
        b.level - a.level ||
        b.overdueDays - a.overdueDays ||
        (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity),
    )
    .slice(0, limit);
}
