import { requireUser } from '@/lib/auth';
import { Forbidden } from '@/components/forbidden';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { resolveDataSource } from '@/lib/adapters/datasource';
import { getAiProvider } from '@/lib/adapters/ai';
import { getSearchProvider } from '@/lib/adapters/search';
import { getNotificationProvider } from '@/lib/adapters/notification';
import {
  BD_WEIGHT_LABELS,
  MATCH_WEIGHT_LABELS,
  getBdWeights,
  getEscalationSettings,
  getMatchWeights,
  getScheduleSettings,
  getSlaSettings,
} from '@/lib/settings';
import { Badge, Card, Cell, Empty, PageHeader, Row, Table } from '@/components/ui';
import { JobRunner, OperationsForm, SlaForm, WeightsForm } from '@/components/settings-forms';
import { formatDateTime } from '@/lib/domain/dates';

export const dynamic = 'force-dynamic';

/** 管理設定。SLA・重み・エスカレーション・定期実行を画面から変更できる (§6/§9/§11/§18/§52)。 */
export default async function SettingsPage() {
  const user = await requireUser();
  if (!can(user, 'settings:write')) return <Forbidden needed="settings:write" />;

  const [matchWeights, bdWeights, sla, escalation, schedule, dataSource, jobLogs] = await Promise.all([
    getMatchWeights(),
    getBdWeights(),
    getSlaSettings(),
    getEscalationSettings(),
    getScheduleSettings(),
    resolveDataSource(),
    prisma.jobRunLog.findMany({ orderBy: { startedAt: 'desc' }, take: 15 }),
  ]);

  const ai = getAiProvider();
  const search = getSearchProvider();
  const notification = getNotificationProvider();

  return (
    <>
      <PageHeader title="設定" description="AI の判断基準と運用ルールを変更します" />

      <div className="space-y-4 p-6">
        <Card title="接続状態" subtitle="APIキー未設定でも Mock で動作します (§42)">
          <div className="grid gap-2 md:grid-cols-4">
            <Adapter name="データソース" value={dataSource.source.name} detail={dataSource.health.detail} ok={!dataSource.fellBack} />
            <Adapter name="AI Provider" value={ai.name} detail={ai.model} ok={ai.name !== 'mock'} />
            <Adapter name="Web Search" value={search.name} detail="" ok={search.name !== 'mock'} />
            <Adapter name="通知" value={notification.name} detail="" ok={notification.name !== 'console'} />
          </div>
        </Card>

        <Card title="求人マッチングスコアの重み (§11)" subtitle="変更は次回のスコア計算から反映されます">
          <WeightsForm weights={matchWeights as unknown as Record<string, number>} labels={MATCH_WEIGHT_LABELS} kind="match" />
        </Card>

        <Card title="Business Development Score の重み (§18)">
          <WeightsForm weights={bdWeights as unknown as Record<string, number>} labels={BD_WEIGHT_LABELS} kind="bd" />
        </Card>

        <Card title="フェーズ別 SLA (§6)" subtitle="フェーズごとの期限と、超過時のアラートレベル">
          <SlaForm warnRatio={sla.warnRatio} rules={sla.rules} />
        </Card>

        <Card title="エスカレーションと定期実行 (§9/§52)">
          <OperationsForm escalation={escalation} schedule={schedule} />
        </Card>

        <Card title="ジョブの手動実行" subtitle="定期実行と同じ処理をその場で走らせます">
          <JobRunner />
        </Card>

        <Card title="ジョブ実行履歴">
          {jobLogs.length === 0 ? (
            <Empty>実行履歴はまだありません。</Empty>
          ) : (
            <Table head={['ジョブ', '開始', '終了', '状態', '結果']}>
              {jobLogs.map((log) => (
                <Row key={log.id}>
                  <Cell className="font-medium">{log.jobName}</Cell>
                  <Cell>{formatDateTime(log.startedAt)}</Cell>
                  <Cell>{formatDateTime(log.finishedAt)}</Cell>
                  <Cell>
                    <Badge tone={log.status === 'success' ? 'done' : log.status === 'failed' ? 'crit' : 'warn'}>
                      {log.status}
                    </Badge>
                  </Cell>
                  <Cell className="max-w-md">{log.summary ?? log.error ?? '—'}</Cell>
                </Row>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}

function Adapter({ name, value, detail, ok }: { name: string; value: string; detail: string; ok: boolean }) {
  return (
    <div className="rounded border border-[var(--border)] p-2">
      <div className="text-xxs text-[var(--text-muted)]">{name}</div>
      <div className="mt-0.5 flex items-center gap-1.5">
        <span className="text-sm font-medium">{value}</span>
        <Badge tone={ok ? 'done' : 'warn'}>{ok ? '○ 接続' : '△ Mock'}</Badge>
      </div>
      {detail && <p className="mt-0.5 break-words text-xxs text-[var(--text-muted)]">{detail}</p>}
    </div>
  );
}
