import Link from 'next/link';
import { Badge, Card, EmptyState, Table, Td, Th } from '@/components/ui';
import { requireAdmin } from '@/server/guards';
import { listCandidates } from '@/server/services/candidate-admin';
import { getDb, schema } from '@/db/client';
import { CANDIDATE_STATUS_LABELS, formatDate, formatSalaryRange, labelOf } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function AdminCandidatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const query = await searchParams;

  const [rows, salesUsers, locations] = await Promise.all([
    listCandidates({
      status: query.status,
      salesUserId: query.salesUserId,
      locationId: query.locationId,
      qualifiedOnly: query.qualified === '1',
      limit: 200,
    }),
    getDb().query.users.findMany(),
    getDb().query.locations.findMany(),
  ]);

  const selectClass =
    'mt-1 block rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-ink-700';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-ink-900">候補者</h1>
        <p className="text-xs text-ink-500">獲得元・診断結果・進捗を1つのIDで追跡します（最大200件）</p>
      </div>

      <form action="/admin/candidates" className="flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200 bg-white p-4">
        <label className="text-xs text-ink-500">
          ステータス
          <select name="status" defaultValue={query.status ?? ''} className={selectClass}>
            <option value="">すべて</option>
            {schema.candidateStatusEnum.enumValues.map((value) => (
              <option key={value} value={value}>
                {labelOf(CANDIDATE_STATUS_LABELS, value)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-ink-500">
          営業担当
          <select name="salesUserId" defaultValue={query.salesUserId ?? ''} className={selectClass}>
            <option value="">すべて</option>
            {salesUsers
              .filter((user) => user.role === 'sales')
              .map((user) => (
                <option key={user.id} value={user.id}>
                  {user.displayName}
                </option>
              ))}
          </select>
        </label>
        <label className="text-xs text-ink-500">
          場所
          <select name="locationId" defaultValue={query.locationId ?? ''} className={selectClass}>
            <option value="">すべて</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.venueName}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-1.5 text-xs text-ink-500">
          <input type="checkbox" name="qualified" value="1" defaultChecked={query.qualified === '1'} />
          有望候補者のみ
        </label>
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-brand-700"
        >
          絞り込む
        </button>
      </form>

      <Card>
        {rows.length === 0 ? (
          <EmptyState title="条件に一致する候補者がいません" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>取得日</Th>
                <Th>候補者ID</Th>
                <Th>ステータス</Th>
                <Th>年代 / 勤務地</Th>
                <Th>ランク</Th>
                <Th align="right">想定年収レンジ</Th>
                <Th>獲得営業</Th>
                <Th>獲得場所</Th>
                <Th align="center">個人情報</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <Td>{formatDate(row.createdAt)}</Td>
                  <Td>
                    <Link href={`/admin/candidates/${row.id}`} className="text-brand-600 underline">
                      {row.id.slice(0, 8)}
                    </Link>
                  </Td>
                  <Td>
                    <Badge tone={row.qualified ? 'brand' : 'neutral'}>
                      {labelOf(CANDIDATE_STATUS_LABELS, row.status)}
                    </Badge>
                  </Td>
                  <Td>
                    {row.ageBand ?? '—'} / {row.prefecture ?? '—'}
                  </Td>
                  <Td>{row.valueRank ?? '—'}</Td>
                  <Td align="right">
                    {formatSalaryRange(row.estimatedSalaryLow, row.estimatedSalaryHigh)}
                  </Td>
                  <Td>{row.salesUserName ?? '—'}</Td>
                  <Td>{row.venueName ?? '—'}</Td>
                  <Td align="center">{row.hasPii ? '登録済' : '—'}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
