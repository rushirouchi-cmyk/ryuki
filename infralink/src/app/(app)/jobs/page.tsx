import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { Forbidden } from '@/components/forbidden';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { parseList } from '@/lib/json';
import { Badge, Card, Cell, Empty, PageHeader, Row, Table } from '@/components/ui';
import { JOB_CATEGORIES } from '@/lib/domain/taxonomy';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

/** 求人一覧。PORTERS 由来の求人を職種・勤務地・年収で絞り込む。 */
export default async function JobsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  if (!can(user, 'job:read')) return <Forbidden needed="job:read" />;
  const params = await searchParams;

  const category = one(params.category);
  const location = one(params.location);
  const salaryMin = Number(one(params.salaryMin)) || 0;
  const status = one(params.status) || 'open';

  const jobs = await prisma.job.findMany({
    where: {
      ...(status !== 'all' ? { status } : {}),
      ...(category ? { jobCategory: category } : {}),
      ...(location ? { location: { contains: location } } : {}),
      ...(salaryMin ? { salaryMax: { gte: salaryMin } } : {}),
    },
    include: { company: true, _count: { select: { applications: true, matches: true } } },
    orderBy: { updatedAt: 'desc' },
  });

  return (
    <>
      <PageHeader title="求人" description={`${jobs.length}件を表示`} />
      <div className="space-y-4 p-6">
        <Card title="フィルター">
          <form className="grid grid-cols-2 gap-2 md:grid-cols-5" method="get">
            <label className="block">
              <span className="text-xxs text-[var(--text-muted)]">職種</span>
              <select name="category" defaultValue={category} className="mt-0.5 w-full rounded border border-[var(--border)] px-1.5 py-1 text-xs">
                <option value="">指定なし</option>
                {JOB_CATEGORIES.map((c) => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xxs text-[var(--text-muted)]">勤務地</span>
              <input name="location" defaultValue={location} className="mt-0.5 w-full rounded border border-[var(--border)] px-1.5 py-1 text-xs" />
            </label>
            <label className="block">
              <span className="text-xxs text-[var(--text-muted)]">上限年収 下限</span>
              <input name="salaryMin" type="number" step="100000" defaultValue={salaryMin || ''} className="mt-0.5 w-full rounded border border-[var(--border)] px-1.5 py-1 text-xs" />
            </label>
            <label className="block">
              <span className="text-xxs text-[var(--text-muted)]">状態</span>
              <select name="status" defaultValue={status} className="mt-0.5 w-full rounded border border-[var(--border)] px-1.5 py-1 text-xs">
                <option value="open">募集中</option>
                <option value="closed">クローズ</option>
                <option value="all">すべて</option>
              </select>
            </label>
            <div className="flex items-end gap-1">
              <button className="flex-1 rounded border border-[var(--accent)] bg-[var(--accent)] px-2 py-1 text-xs text-white">適用</button>
              <Link href="/jobs" className="rounded border border-[var(--border)] px-2 py-1 text-xs">解除</Link>
            </div>
          </form>
        </Card>

        <Card>
          {jobs.length === 0 ? (
            <Empty>該当する求人がありません。</Empty>
          ) : (
            <Table head={['求人', '企業', '職種', '勤務地', '年収', '必須スキル', '必要資格', '推薦', 'マッチ']}>
              {jobs.map((job) => (
                <Row key={job.id}>
                  <Cell className="max-w-[18rem] font-medium">{job.jobTitle}</Cell>
                  <Cell>
                    <Link href={`/companies/${job.companyId}`} className="text-[var(--accent)] hover:underline">
                      {job.company.companyName}
                    </Link>
                  </Cell>
                  <Cell>{job.jobCategory ?? '—'}</Cell>
                  <Cell>{job.location ?? '—'}</Cell>
                  <Cell className="tabular whitespace-nowrap">
                    {job.salaryMin ? `${(job.salaryMin / 10000).toFixed(0)}〜${((job.salaryMax ?? 0) / 10000).toFixed(0)}万` : '—'}
                  </Cell>
                  <Cell>
                    <div className="flex flex-wrap gap-0.5">
                      {parseList(job.requiredSkills).map((s) => (
                        <Badge key={s}>{s}</Badge>
                      ))}
                    </div>
                  </Cell>
                  <Cell>
                    <div className="flex flex-wrap gap-0.5">
                      {parseList(job.qualifications).map((q) => (
                        <Badge key={q} tone="done">{q}</Badge>
                      ))}
                    </div>
                  </Cell>
                  <Cell className="tabular">{job._count.applications}</Cell>
                  <Cell className="tabular">{job._count.matches}</Cell>
                </Row>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
