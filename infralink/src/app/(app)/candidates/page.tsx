import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { Forbidden } from '@/components/forbidden';
import { can, defaultCandidateScope } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { AlertBadge, Badge, Card, Cell, Empty, PageHeader, Row, Table } from '@/components/ui';
import { PHASE_LABELS, CANDIDATE_PHASES, type AlertLevel, type CandidatePhase } from '@/lib/domain/enums';
import { describeDue, formatDate } from '@/lib/domain/dates';
import { normalizeJobCategory, JOB_CATEGORIES, QUALIFICATIONS, SKILLS } from '@/lib/domain/taxonomy';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

/** 候補者一覧 (§48 フィルター)。 */
export default async function CandidatesPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  if (!can(user, 'candidate:read_all')) return <Forbidden needed="candidate:read_all" />;
  const params = await searchParams;

  const filters = {
    ca: one(params.ca),
    phase: one(params.phase),
    jobCategory: one(params.jobCategory),
    location: one(params.location),
    overdue: one(params.overdue) === '1',
    salaryMin: Number(one(params.salaryMin)) || 0,
    qualification: one(params.qualification),
    skill: one(params.skill),
  };

  // CA は既定で自分の担当に絞る。明示的に ca=all を指定すれば全件。
  const scope = one(params.ca) ? {} : defaultCandidateScope(user);

  const candidates = await prisma.candidate.findMany({
    where: {
      status: 'active',
      ...scope,
      ...(filters.ca && filters.ca !== 'all' ? { ownerCaId: filters.ca } : {}),
      ...(filters.phase ? { phase: filters.phase } : {}),
      ...(filters.location ? { location: { contains: filters.location } } : {}),
      ...(filters.salaryMin ? { desiredSalary: { gte: filters.salaryMin } } : {}),
      ...(filters.qualification
        ? { qualifications: { some: { qualificationName: filters.qualification } } }
        : {}),
      ...(filters.skill ? { skills: { some: { skillName: filters.skill } } } : {}),
    },
    include: {
      ownerCa: true,
      careers: true,
      alerts: { where: { status: { in: ['open', 'escalated'] } } },
    },
    orderBy: { nextActionDate: 'asc' },
  });

  const cas = await prisma.user.findMany({ where: { role: 'CA', active: true } });

  const rows = candidates
    .map((c) => {
      const primary = [...c.careers].sort((a, b) => (b.yearsExperience ?? 0) - (a.yearsExperience ?? 0))[0];
      const level = Math.max(0, ...c.alerts.map((a) => a.alertLevel)) as AlertLevel | 0;
      const due = describeDue(c.nextActionDate);
      return {
        candidate: c,
        jobCategory: normalizeJobCategory(primary?.jobCategory) ?? '—',
        level,
        due,
      };
    })
    .filter((r) => (filters.jobCategory ? r.jobCategory === filters.jobCategory : true))
    .filter((r) => (filters.overdue ? r.due.overdue : true))
    .sort((a, b) => b.level - a.level || b.due.overdueDays - a.due.overdueDays);

  return (
    <>
      <PageHeader title="候補者" description={`${rows.length}名を表示`} />

      <div className="space-y-4 p-6">
        <Card title="フィルター">
          <form className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-8" method="get">
            <Select name="ca" label="担当CA" value={filters.ca}
              options={[{ value: 'all', label: '全員' }, ...cas.map((c) => ({ value: c.id, label: c.name }))]} />
            <Select name="phase" label="フェーズ" value={filters.phase}
              options={CANDIDATE_PHASES.map((p) => ({ value: p, label: PHASE_LABELS[p] }))} />
            <Select name="jobCategory" label="職種" value={filters.jobCategory}
              options={JOB_CATEGORIES.map((c) => ({ value: c.name, label: c.name }))} />
            <label className="block">
              <span className="text-xxs text-[var(--text-muted)]">勤務地</span>
              <input name="location" defaultValue={filters.location}
                className="mt-0.5 w-full rounded border border-[var(--border)] px-1.5 py-1 text-xs" />
            </label>
            <label className="block">
              <span className="text-xxs text-[var(--text-muted)]">希望年収 下限</span>
              <input name="salaryMin" type="number" step="100000" defaultValue={filters.salaryMin || ''}
                className="mt-0.5 w-full rounded border border-[var(--border)] px-1.5 py-1 text-xs" />
            </label>
            <Select name="qualification" label="資格" value={filters.qualification}
              options={QUALIFICATIONS.map((q) => ({ value: q.name, label: q.name }))} />
            <Select name="skill" label="スキル" value={filters.skill}
              options={SKILLS.map((s) => ({ value: s.name, label: s.name }))} />
            <div className="flex flex-col justify-end gap-1">
              <label className="flex items-center gap-1 text-xxs">
                <input type="checkbox" name="overdue" value="1" defaultChecked={filters.overdue} />
                期限超過のみ
              </label>
              <div className="flex gap-1">
                <button className="flex-1 rounded border border-[var(--accent)] bg-[var(--accent)] px-2 py-1 text-xs text-white">
                  適用
                </button>
                <Link href="/candidates" className="rounded border border-[var(--border)] px-2 py-1 text-xs">
                  解除
                </Link>
              </div>
            </div>
          </form>
        </Card>

        <Card>
          {rows.length === 0 ? (
            <Empty>該当する候補者がいません。</Empty>
          ) : (
            <Table head={['状態', '氏名', 'フェーズ', '職種', '勤務地', '希望年収', '担当CA', '次回Action', '期限']}>
              {rows.map(({ candidate, jobCategory, level, due }) => (
                <Row key={candidate.id}>
                  <Cell>{level !== 0 ? <AlertBadge level={level} /> : <Badge tone="done">○ 正常</Badge>}</Cell>
                  <Cell>
                    <Link href={`/candidates/${candidate.id}`} className="font-medium text-[var(--accent)] hover:underline">
                      {candidate.name}
                    </Link>
                    {candidate.rank && <span className="ml-1 text-xxs text-[var(--text-muted)]">{candidate.rank}</span>}
                  </Cell>
                  <Cell><Badge>{PHASE_LABELS[candidate.phase as CandidatePhase] ?? candidate.phase}</Badge></Cell>
                  <Cell>{jobCategory}</Cell>
                  <Cell>{candidate.location ?? '—'}</Cell>
                  <Cell className="tabular">
                    {candidate.desiredSalary ? `${(candidate.desiredSalary / 10000).toFixed(0)}万` : '—'}
                  </Cell>
                  <Cell>{candidate.ownerCa?.name ?? '未割当'}</Cell>
                  <Cell className="max-w-[16rem] truncate">{candidate.nextAction ?? '—'}</Cell>
                  <Cell className={due.overdue ? 'text-late-fg' : ''}>
                    {due.overdue ? '! ' : ''}
                    {formatDate(candidate.nextActionDate)}
                    <div className="text-xxs text-[var(--text-muted)]">{due.label}</div>
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

function Select({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="text-xxs text-[var(--text-muted)]">{label}</span>
      <select
        name={name}
        defaultValue={value}
        className="mt-0.5 w-full rounded border border-[var(--border)] px-1.5 py-1 text-xs"
      >
        <option value="">指定なし</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
