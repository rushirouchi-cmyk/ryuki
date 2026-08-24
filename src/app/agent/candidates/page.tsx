import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { candidates, occupations, referrals } from "@/lib/db/schema";
import { latestDiagnosisFor } from "@/lib/domain/diagnosis/latest";
import { requireRole } from "@/lib/auth/guards";
import {
  Badge,
  EmptyState,
  NumTd,
  PageHeader,
  RankBadge,
  TableWrap,
  Td,
  Th,
} from "@/components/ui";
import { REFERRAL_STATUS_LABELS, labelOf } from "@/lib/utils/labels";
import { formatManRange, formatManYen } from "@/lib/utils/format";

export default async function AgentCandidatesPage() {
  const user = await requireRole("agent");
  const companyId = user.agentCompanyId;
  if (companyId === null) {
    return <EmptyState title="所属エージェント企業が設定されていません" />;
  }

  const db = await getDb();
  const diagnosis = latestDiagnosisFor(db);

  const rows = await db
    .select({
      referralId: referrals.id,
      status: referrals.status,
      referredAt: referrals.referredAt,
      matchRank: diagnosis.matchRank,
      currentSalary: diagnosis.currentSalaryYen,
      estimatedLow: diagnosis.estimatedSalaryLow,
      estimatedHigh: diagnosis.estimatedSalaryHigh,
      experienceYears: diagnosis.experienceYears,
      occupationName: occupations.name,
      offerSalary: referrals.offerSalaryYen,
    })
    .from(referrals)
    .innerJoin(candidates, eq(referrals.candidateId, candidates.id))
    .leftJoin(diagnosis, eq(diagnosis.candidateId, candidates.id))
    .leftJoin(occupations, eq(diagnosis.currentOccupationId, occupations.id))
    .where(eq(referrals.agentCompanyId, companyId))
    .orderBy(desc(referrals.referredAt));

  return (
    <>
      <PageHeader
        title="紹介候補者"
        description="自社に送客された候補者のみが表示されます。"
      />

      {rows.length === 0 ? (
        <EmptyState title="まだ紹介された候補者はいません" />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>紹介日</Th>
              <Th>状態</Th>
              <Th>ランク</Th>
              <Th>現職</Th>
              <Th className="text-right">経験</Th>
              <Th className="text-right">現年収</Th>
              <Th className="text-right">市場年収レンジ</Th>
              <Th className="text-right">提示年収</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.referralId}>
                <Td className="text-ink-500">
                  {row.referredAt.toLocaleDateString("ja-JP")}
                </Td>
                <Td>
                  <Badge
                    tone={
                      row.status === "joined"
                        ? "positive"
                        : row.status === "pending"
                          ? "brand"
                          : row.status === "declined" || row.status === "lost"
                            ? "neutral"
                            : "caution"
                    }
                  >
                    {labelOf(REFERRAL_STATUS_LABELS, row.status)}
                  </Badge>
                </Td>
                <Td>
                  <RankBadge rank={row.matchRank} />
                </Td>
                <Td className="font-medium">{row.occupationName ?? "—"}</Td>
                <NumTd>{row.experienceYears ?? "—"}年</NumTd>
                <NumTd>{formatManYen(row.currentSalary)}</NumTd>
                <NumTd>{formatManRange(row.estimatedLow, row.estimatedHigh)}</NumTd>
                <NumTd>{formatManYen(row.offerSalary)}</NumTd>
                <Td>
                  <Link
                    href={`/agent/candidates/${row.referralId}`}
                    className="text-sm font-medium text-brand-600 hover:underline"
                  >
                    詳細
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}
