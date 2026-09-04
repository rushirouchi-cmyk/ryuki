import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { buildTodoList } from '@/lib/views/today';
import { prisma } from '@/lib/db';
import { AlertBadge, Badge, Card, Empty, PageHeader, Stat } from '@/components/ui';
import { formatDateTime } from '@/lib/domain/dates';

export const dynamic = 'force-dynamic';

/** CA Dashboard (§25): 開いた瞬間に「今日やるべきこと」が優先順位付きで見える。 */
export default async function CaDashboard() {
  const user = await requireUser();
  // CA は自分の担当分。管理者・経営者は全件を見る。
  const scopeCaId = user.role === 'CA' ? user.id : undefined;

  const [todos, activeCount, pendingInquiries] = await Promise.all([
    buildTodoList({ caId: scopeCaId, limit: 60 }),
    prisma.candidate.count({ where: { status: 'active', ...(scopeCaId ? { ownerCaId: scopeCaId } : {}) } }),
    prisma.aiAlert.count({
      where: { status: 'open', firstNotificationAt: { not: null }, ...(scopeCaId ? { caId: scopeCaId } : {}) },
    }),
  ]);

  const critical = todos.filter((t) => t.level === 3);
  const overdue = todos.filter((t) => t.overdueDays > 0);
  const today = todos.filter((t) => t.overdueDays === 0);

  return (
    <>
      <PageHeader
        title="今日やること"
        description={`${user.name} / 優先度の高い順に表示しています`}
      />

      <div className="space-y-4 p-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="担当稼働候補者" value={activeCount} />
          <Stat label="本日対応" value={today.length} tone="warn" />
          <Stat label="期限超過" value={overdue.length} tone="late" />
          <Stat label="重大" value={critical.length} tone="crit" hint="即時対応が必要" />
        </div>

        {pendingInquiries > 0 && (
          <div className="rounded-md border border-warn-line bg-warn-bg px-3 py-2 text-xs text-warn-fg">
            △ AI からの状況確認が {pendingInquiries} 件、未回答です。
            <Link href="/alerts" className="ml-2 underline">
              回答する
            </Link>
          </div>
        )}

        <Card title="Todo" subtitle="アラートレベル → 超過日数 → 期限 の順">
          {todos.length === 0 ? (
            <Empty>対応が必要な項目はありません。</Empty>
          ) : (
            <ol className="divide-y divide-[var(--border)]">
              {todos.map((todo, index) => (
                <li key={`${todo.candidateId}-${todo.alertId ?? index}`} className="flex items-start gap-3 py-2">
                  <span className="tabular w-6 shrink-0 pt-0.5 text-xs text-[var(--text-muted)]">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/candidates/${todo.candidateId}`}
                        className="text-sm font-medium text-[var(--accent)] hover:underline"
                      >
                        {todo.candidateName}様
                      </Link>
                      <Badge>{todo.phaseLabel}</Badge>
                      {todo.level !== 0 ? (
                        <AlertBadge level={todo.level} />
                      ) : (
                        <Badge tone="normal">予定</Badge>
                      )}
                      {todo.awaitingCaResponse && <Badge tone="warn">△ AI確認 未回答</Badge>}
                      {!scopeCaId && todo.caName && <Badge>担当: {todo.caName}</Badge>}
                    </div>
                    <p className="mt-0.5 text-xs">{todo.title}</p>
                    {todo.reason && (
                      <p className="mt-0.5 text-xxs text-[var(--text-muted)]">{todo.reason}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <div
                      className={
                        todo.overdueDays > 0
                          ? 'text-xs font-medium text-late-fg'
                          : 'text-xs text-[var(--text-muted)]'
                      }
                    >
                      {todo.overdueDays > 0 ? '! ' : ''}
                      {todo.dueLabel}
                    </div>
                    <div className="text-xxs text-[var(--text-muted)]">{formatDateTime(todo.dueAt)}</div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </>
  );
}
