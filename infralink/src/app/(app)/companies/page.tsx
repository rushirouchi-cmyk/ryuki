import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { Forbidden } from '@/components/forbidden';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { Badge, Card, Cell, Empty, PageHeader, Row, ScoreChip, Table } from '@/components/ui';
import { TRANSACTION_STATUSES, TRANSACTION_STATUS_LABELS, type TransactionStatus } from '@/lib/domain/enums';
import { formatDate } from '@/lib/domain/dates';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

/** 企業一覧 (§48)。取引状況 / 採用需要 / 業界 / 勤務地 / 開拓Score で絞り込む。 */
export default async function CompaniesPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  if (!can(user, 'company:read')) return <Forbidden needed="company:read" />;
  const params = await searchParams;

  const status = one(params.status);
  const industry = one(params.industry);
  const location = one(params.location);
  const minScore = Number(one(params.minScore)) || 0;
  const hiringOnly = one(params.hiring) === '1';

  const companies = await prisma.company.findMany({
    where: {
      ...(status ? { transactionStatus: status } : {}),
      ...(industry ? { industry: { contains: industry } } : {}),
      ...(location ? { location: { contains: location } } : {}),
    },
    include: {
      jobs: { where: { status: 'open' } },
      webFindings: { where: { activeStatus: 'active' } },
      opportunities: true,
      _count: { select: { applications: true } },
    },
    orderBy: { companyName: 'asc' },
  });

  const rows = companies
    .map((c) => ({
      company: c,
      score: c.opportunities[0]?.score ?? null,
      openings: c.jobs.length + c.webFindings.length,
    }))
    .filter((r) => (minScore ? (r.score ?? 0) >= minScore : true))
    .filter((r) => (hiringOnly ? r.openings > 0 : true))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || b.openings - a.openings);

  return (
    <>
      <PageHeader title="企業" description={`${rows.length}社を表示`} />
      <div className="space-y-4 p-6">
        <Card title="フィルター">
          <form className="grid grid-cols-2 gap-2 md:grid-cols-6" method="get">
            <label className="block">
              <span className="text-xxs text-[var(--text-muted)]">取引状況</span>
              <select name="status" defaultValue={status} className="mt-0.5 w-full rounded border border-[var(--border)] px-1.5 py-1 text-xs">
                <option value="">指定なし</option>
                {TRANSACTION_STATUSES.map((s) => (
                  <option key={s} value={s}>{TRANSACTION_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xxs text-[var(--text-muted)]">業界</span>
              <input name="industry" defaultValue={industry} className="mt-0.5 w-full rounded border border-[var(--border)] px-1.5 py-1 text-xs" />
            </label>
            <label className="block">
              <span className="text-xxs text-[var(--text-muted)]">勤務地</span>
              <input name="location" defaultValue={location} className="mt-0.5 w-full rounded border border-[var(--border)] px-1.5 py-1 text-xs" />
            </label>
            <label className="block">
              <span className="text-xxs text-[var(--text-muted)]">開拓Score 下限</span>
              <input name="minScore" type="number" defaultValue={minScore || ''} className="mt-0.5 w-full rounded border border-[var(--border)] px-1.5 py-1 text-xs" />
            </label>
            <label className="flex items-end gap-1 text-xxs">
              <input type="checkbox" name="hiring" value="1" defaultChecked={hiringOnly} />
              採用需要ありのみ
            </label>
            <div className="flex items-end gap-1">
              <button className="flex-1 rounded border border-[var(--accent)] bg-[var(--accent)] px-2 py-1 text-xs text-white">適用</button>
              <Link href="/companies" className="rounded border border-[var(--border)] px-2 py-1 text-xs">解除</Link>
            </div>
          </form>
        </Card>

        <Card>
          {rows.length === 0 ? (
            <Empty>該当する企業がありません。</Empty>
          ) : (
            <Table head={['企業名', '取引状況', '業界', '所在地', '保有求人', 'WEB求人', '推薦実績', '開拓Score', '登録日']}>
              {rows.map(({ company, score, openings }) => (
                <Row key={company.id}>
                  <Cell>
                    <Link href={`/companies/${company.id}`} className="font-medium text-[var(--accent)] hover:underline">
                      {company.companyName}
                    </Link>
                  </Cell>
                  <Cell>
                    <Badge tone={company.transactionStatus === 'existing' ? 'done' : company.transactionStatus === 'prospect' ? 'warn' : 'accent'}>
                      {TRANSACTION_STATUS_LABELS[company.transactionStatus as TransactionStatus] ?? company.transactionStatus}
                    </Badge>
                  </Cell>
                  <Cell>{company.industry ?? '—'}</Cell>
                  <Cell>{company.location ?? '—'}</Cell>
                  <Cell className="tabular">{company.jobs.length}</Cell>
                  <Cell className="tabular">{company.webFindings.length}</Cell>
                  <Cell className="tabular">{company._count.applications}</Cell>
                  <Cell>{score === null ? '—' : <ScoreChip score={score} size="sm" />}</Cell>
                  <Cell>{formatDate(company.createdAt)}</Cell>
                </Row>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
