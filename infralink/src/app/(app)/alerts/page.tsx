import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AlertBadge, Badge, Card, Empty, PageHeader, Stat } from '@/components/ui';
import { AlertResponseForm } from '@/components/candidate-forms';
import { buildCaInquiry } from '@/lib/agents/ca-supervisor';
import { ALERT_TYPE_LABELS, PHASE_LABELS, type AlertLevel, type AlertType, type CandidatePhase } from '@/lib/domain/enums';
import { formatDateTime } from '@/lib/domain/dates';

export const dynamic = 'force-dynamic';

/** アラート一覧。CA は自分宛のみ、経営者・管理者は全件を見る (§49)。 */
export default async function AlertsPage() {
  const user = await requireUser();
  const scope = user.role === 'CA' ? { caId: user.id } : {};

  const alerts = await prisma.aiAlert.findMany({
    where: { status: { in: ['open', 'escalated'] }, ...scope },
    include: { candidate: { include: { ownerCa: true } }, ca: true },
    orderBy: [{ alertLevel: 'desc' }, { dueAt: 'asc' }],
  });

  const counts = {
    level1: alerts.filter((a) => a.alertLevel === 1).length,
    level2: alerts.filter((a) => a.alertLevel === 2).length,
    level3: alerts.filter((a) => a.alertLevel === 3).length,
    awaiting: alerts.filter((a) => a.firstNotificationAt && a.status === 'open').length,
  };

  return (
    <>
      <PageHeader
        title="AI アラート"
        description={user.role === 'CA' ? '自分が担当する候補者のアラート' : '全候補者のアラート'}
      />

      <div className="space-y-4 p-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Lv1 注意" value={counts.level1} tone="warn" hint="△ 期限接近" />
          <Stat label="Lv2 遅延" value={counts.level2} tone="late" hint="! 期限超過" />
          <Stat label="Lv3 重大" value={counts.level3} tone="crit" hint="■ 即時対応" />
          <Stat label="AI確認 未回答" value={counts.awaiting} />
        </div>

        {alerts.length === 0 ? (
          <Card>
            <Empty>対応が必要なアラートはありません。</Empty>
          </Card>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <Card key={alert.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <AlertBadge level={alert.alertLevel as AlertLevel} />
                  <span className="text-sm font-medium">
                    {ALERT_TYPE_LABELS[alert.alertType as AlertType] ?? alert.alertType}
                  </span>
                  {alert.candidate && (
                    <>
                      <Link href={`/candidates/${alert.candidateId}`} className="text-xs text-[var(--accent)] hover:underline">
                        {alert.candidate.name}様
                      </Link>
                      <Badge>{PHASE_LABELS[alert.candidate.phase as CandidatePhase] ?? alert.candidate.phase}</Badge>
                    </>
                  )}
                  <Badge>担当: {alert.ca?.name ?? '未割当'}</Badge>
                  {alert.escalatedAt && <Badge tone="crit">■ 経営層へエスカレーション済</Badge>}
                  {alert.secondNotificationAt && !alert.escalatedAt && <Badge tone="warn">△ 再通知済</Badge>}
                </div>

                <p className="mt-1 text-xs">{alert.reason}</p>
                <p className="text-xxs text-[var(--text-muted)]">
                  検知 {formatDateTime(alert.detectedAt)} / 期限 {formatDateTime(alert.dueAt)}
                  {alert.firstNotificationAt && ` / AI確認 ${formatDateTime(alert.firstNotificationAt)}`}
                </p>

                {alert.alertType !== 'ca_no_response' && (
                  <div className="mt-2 border-t border-[var(--border)] pt-2">
                    <AlertResponseForm
                      alertId={alert.id}
                      question={buildCaInquiry({
                        candidateName: alert.candidate?.name ?? '',
                        dueAt: alert.dueAt ?? alert.detectedAt,
                        reason: alert.reason,
                      })}
                    />
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
