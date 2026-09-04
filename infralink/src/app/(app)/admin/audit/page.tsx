import { requireUser } from '@/lib/auth';
import { Forbidden } from '@/components/forbidden';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { Badge, Card, Cell, Empty, PageHeader, Row, Table } from '@/components/ui';
import { formatDateTime } from '@/lib/domain/dates';

export const dynamic = 'force-dynamic';

/** 監査ログ (§50)。AI による変更は actor=AI として区別できる。 */
export default async function AuditPage() {
  const user = await requireUser();
  if (!can(user, 'audit:read')) return <Forbidden needed="audit:read" />;

  const [logs, notifications] = await Promise.all([
    prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200, include: { actor: true } }),
    prisma.notificationLog.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
  ]);

  return (
    <>
      <PageHeader title="監査ログ" description="誰が・いつ・何を変更したか。AI による変更も記録します" />

      <div className="space-y-4 p-6">
        <Card title="変更履歴">
          {logs.length === 0 ? (
            <Empty>記録はまだありません。</Empty>
          ) : (
            <Table head={['日時', '実行者', '対象', '操作', '変更前', '変更後']}>
              {logs.map((log) => (
                <Row key={log.id}>
                  <Cell className="whitespace-nowrap">{formatDateTime(log.createdAt)}</Cell>
                  <Cell>
                    <Badge tone={log.actorType === 'AI' ? 'accent' : log.actorType === 'system' ? 'normal' : 'done'}>
                      {log.actorType === 'human' ? (log.actor?.name ?? '不明') : log.actorLabel ?? log.actorType}
                    </Badge>
                  </Cell>
                  <Cell>
                    {log.entityType}
                    <div className="text-xxs text-[var(--text-muted)]">{log.entityId.slice(0, 12)}</div>
                  </Cell>
                  <Cell>{log.action}</Cell>
                  <Cell className="max-w-[16rem] truncate text-xxs">{log.before ?? '—'}</Cell>
                  <Cell className="max-w-[16rem] truncate text-xxs">{log.after ?? '—'}</Cell>
                </Row>
              ))}
            </Table>
          )}
        </Card>

        <Card title="通知履歴 (§30)">
          {notifications.length === 0 ? (
            <Empty>通知履歴はありません。</Empty>
          ) : (
            <Table head={['日時', 'チャネル', '宛先', '件名', '状態']}>
              {notifications.map((n) => (
                <Row key={n.id}>
                  <Cell className="whitespace-nowrap">{formatDateTime(n.createdAt)}</Cell>
                  <Cell>{n.channel}</Cell>
                  <Cell>{n.recipient}</Cell>
                  <Cell className="max-w-md truncate">{n.subject}</Cell>
                  <Cell>
                    <Badge tone={n.status === 'sent' ? 'done' : 'crit'}>{n.status}</Badge>
                  </Cell>
                </Row>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
