import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Badge, Card, Cell, Empty, PageHeader, Row, Table } from '@/components/ui';
import { PHASE_LABELS, TRANSACTION_STATUS_LABELS, type CandidatePhase, type TransactionStatus } from '@/lib/domain/enums';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** グローバル検索の結果 (§47)。候補者 / 企業 / 求人 / スキル / 資格 を横断する。 */
export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  await requireUser();
  const params = await searchParams;
  const q = (Array.isArray(params.q) ? params.q[0] : params.q)?.trim() ?? '';

  if (!q) {
    return (
      <>
        <PageHeader title="検索" />
        <div className="p-6">
          <Empty>検索語を入力してください。</Empty>
        </div>
      </>
    );
  }

  const [candidates, companies, jobs] = await Promise.all([
    prisma.candidate.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { nameKana: { contains: q } },
          { location: { contains: q } },
          { skills: { some: { skillName: { contains: q } } } },
          { qualifications: { some: { qualificationName: { contains: q } } } },
          { careers: { some: { companyName: { contains: q } } } },
        ],
      },
      include: { ownerCa: true },
      take: 25,
    }),
    prisma.company.findMany({
      where: { OR: [{ companyName: { contains: q } }, { industry: { contains: q } }, { location: { contains: q } }] },
      take: 25,
    }),
    prisma.job.findMany({
      where: {
        OR: [
          { jobTitle: { contains: q } },
          { jobCategory: { contains: q } },
          { requiredSkills: { contains: q } },
          { qualifications: { contains: q } },
          { location: { contains: q } },
        ],
      },
      include: { company: true },
      take: 25,
    }),
  ]);

  return (
    <>
      <PageHeader
        title={`「${q}」の検索結果`}
        description={`候補者 ${candidates.length}件 / 企業 ${companies.length}件 / 求人 ${jobs.length}件`}
      />

      <div className="space-y-4 p-6">
        <Card title="候補者">
          {candidates.length === 0 ? (
            <Empty>該当なし</Empty>
          ) : (
            <Table head={['氏名', 'フェーズ', '勤務地', '担当CA']}>
              {candidates.map((c) => (
                <Row key={c.id}>
                  <Cell>
                    <Link href={`/candidates/${c.id}`} className="text-[var(--accent)] hover:underline">
                      {c.name}
                    </Link>
                  </Cell>
                  <Cell><Badge>{PHASE_LABELS[c.phase as CandidatePhase] ?? c.phase}</Badge></Cell>
                  <Cell>{c.location ?? '—'}</Cell>
                  <Cell>{c.ownerCa?.name ?? '未割当'}</Cell>
                </Row>
              ))}
            </Table>
          )}
        </Card>

        <Card title="企業">
          {companies.length === 0 ? (
            <Empty>該当なし</Empty>
          ) : (
            <Table head={['企業名', '取引状況', '業界', '所在地']}>
              {companies.map((c) => (
                <Row key={c.id}>
                  <Cell>
                    <Link href={`/companies/${c.id}`} className="text-[var(--accent)] hover:underline">
                      {c.companyName}
                    </Link>
                  </Cell>
                  <Cell>
                    <Badge tone={c.transactionStatus === 'existing' ? 'done' : 'accent'}>
                      {TRANSACTION_STATUS_LABELS[c.transactionStatus as TransactionStatus] ?? c.transactionStatus}
                    </Badge>
                  </Cell>
                  <Cell>{c.industry ?? '—'}</Cell>
                  <Cell>{c.location ?? '—'}</Cell>
                </Row>
              ))}
            </Table>
          )}
        </Card>

        <Card title="求人">
          {jobs.length === 0 ? (
            <Empty>該当なし</Empty>
          ) : (
            <Table head={['求人', '企業', '職種', '勤務地']}>
              {jobs.map((j) => (
                <Row key={j.id}>
                  <Cell>{j.jobTitle}</Cell>
                  <Cell>
                    <Link href={`/companies/${j.companyId}`} className="text-[var(--accent)] hover:underline">
                      {j.company.companyName}
                    </Link>
                  </Cell>
                  <Cell>{j.jobCategory ?? '—'}</Cell>
                  <Cell>{j.location ?? '—'}</Cell>
                </Row>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
