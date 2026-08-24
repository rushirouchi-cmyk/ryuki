import { desc } from 'drizzle-orm';
import { Alert, Badge, Card, EmptyState, Stat, Table, Td, Th } from '@/components/ui';
import { requireAdmin } from '@/server/guards';
import { getDb, schema } from '@/db/client';
import {
  EVENT_LABELS,
  formatDate,
  formatDateTime,
  formatYen,
  INCENTIVE_STATUS_LABELS,
  labelOf,
} from '@/lib/format';
import { toggleIncentiveRuleAction, updateLedgerStatusAction } from '../actions';
import { IncentiveRuleForm } from './rule-form';

export const dynamic = 'force-dynamic';

const NEXT_STATUS: { value: string; label: string }[] = [
  { value: 'approved', label: '承認' },
  { value: 'rejected', label: '却下' },
  { value: 'paid', label: '支払済' },
  { value: 'pending', label: '承認待ちに戻す' },
];

export default async function IncentiveSettingsPage() {
  await requireAdmin();
  const db = getDb();
  const [rules, ledger, users] = await Promise.all([
    db.query.incentiveRules.findMany({ orderBy: [desc(schema.incentiveRules.validFrom)] }),
    db.query.incentiveLedger.findMany({
      orderBy: [desc(schema.incentiveLedger.occurredAt)],
      limit: 100,
    }),
    db.query.users.findMany(),
  ]);
  const userById = new Map(users.map((user) => [user.id, user]));

  const pending = ledger.filter((entry) => entry.status === 'pending');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-ink-900">インセンティブ設定</h1>
        <p className="text-xs text-ink-500">
          報酬ロジックはコードではなく incentive_rules に保存されます。QR読取そのものには報酬を設定していません。
        </p>
      </div>

      <Alert tone="info">
        同一候補者・同一イベントの二重計上は、incentive_ledger のユニーク制約でDBレベルで防止されています。
      </Alert>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="承認待ち件数" value={pending.length} />
        <Stat label="承認待ち金額" value={formatYen(pending.reduce((sum, e) => sum + e.amount, 0))} />
        <Stat
          label="承認済み金額"
          value={formatYen(
            ledger.filter((e) => e.status === 'approved').reduce((sum, e) => sum + e.amount, 0),
          )}
        />
        <Stat
          label="支払済み金額"
          value={formatYen(ledger.filter((e) => e.status === 'paid').reduce((sum, e) => sum + e.amount, 0))}
        />
      </div>

      <Card title="ルールを追加">
        <IncentiveRuleForm eventTypes={schema.monetizableEventEnum.enumValues} />
      </Card>

      <Card title="インセンティブルール">
        {rules.length === 0 ? (
          <EmptyState title="ルールがありません" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>イベント</Th>
                <Th align="right">金額</Th>
                <Th>説明</Th>
                <Th>条件</Th>
                <Th>適用期間</Th>
                <Th align="center">状態</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id}>
                  <Td>{labelOf(EVENT_LABELS, rule.eventType)}</Td>
                  <Td align="right">{formatYen(rule.amount)}</Td>
                  <Td>{rule.description ?? '—'}</Td>
                  <Td className="text-xs text-ink-500">
                    {Object.keys(rule.conditions).length === 0 ? '—' : JSON.stringify(rule.conditions)}
                  </Td>
                  <Td>
                    {formatDate(rule.validFrom)} 〜 {rule.validTo ? formatDate(rule.validTo) : '無期限'}
                  </Td>
                  <Td align="center">
                    <Badge tone={rule.active ? 'success' : 'neutral'}>{rule.active ? '有効' : '無効'}</Badge>
                  </Td>
                  <Td>
                    <form action={toggleIncentiveRuleAction}>
                      <input type="hidden" name="ruleId" value={rule.id} />
                      <input type="hidden" name="active" value={String(!rule.active)} />
                      <button
                        type="submit"
                        className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-50"
                      >
                        {rule.active ? '無効化' : '有効化'}
                      </button>
                    </form>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card title="インセンティブ明細" description="直近100件・承認フロー">
        {ledger.length === 0 ? (
          <EmptyState title="明細がありません" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>発生日時</Th>
                <Th>営業担当</Th>
                <Th>候補者</Th>
                <Th>イベント</Th>
                <Th align="right">金額</Th>
                <Th>状態</Th>
                <Th>操作</Th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((entry) => (
                <tr key={entry.id}>
                  <Td>{formatDateTime(entry.occurredAt)}</Td>
                  <Td>{userById.get(entry.salesUserId)?.displayName ?? '—'}</Td>
                  <Td>{entry.candidateId.slice(0, 8)}</Td>
                  <Td>{labelOf(EVENT_LABELS, entry.eventType)}</Td>
                  <Td align="right">{formatYen(entry.amount)}</Td>
                  <Td>
                    <Badge
                      tone={
                        entry.status === 'paid'
                          ? 'success'
                          : entry.status === 'approved'
                            ? 'brand'
                            : entry.status === 'rejected'
                              ? 'danger'
                              : 'neutral'
                      }
                    >
                      {labelOf(INCENTIVE_STATUS_LABELS, entry.status)}
                    </Badge>
                  </Td>
                  <Td>
                    <form action={updateLedgerStatusAction} className="flex items-center gap-1.5">
                      <input type="hidden" name="entryId" value={entry.id} />
                      <select
                        name="status"
                        defaultValue=""
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                        aria-label="ステータス変更"
                      >
                        <option value="" disabled>
                          変更
                        </option>
                        {NEXT_STATUS.filter((option) => option.value !== entry.status).map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                      >
                        反映
                      </button>
                    </form>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
