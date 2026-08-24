import Link from "next/link";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  candidateContacts,
  candidates,
  diagnoses,
  locations,
  occupations,
  users,
} from "@/lib/db/schema";
import { resolvePeriod } from "@/lib/analytics/period";
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
import { PeriodTabs } from "@/components/analytics/period-tabs";
import { CANDIDATE_STAGE_LABELS, labelOf } from "@/lib/utils/labels";
import { formatManRange, formatManYen } from "@/lib/utils/format";

export default async function AdminCandidatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const period = resolvePeriod(params);
  const db = await getDb();

  const rows = await db
    .select({
      id: candidates.id,
      stage: candidates.stage,
      qualified: candidates.qualified,
      createdAt: candidates.createdAt,
      hasContact: sql<boolean>`${candidateContacts.candidateId} is not null`,
      salesName: users.name,
      venueName: locations.venueName,
      occupationName: occupations.name,
      currentSalary: diagnoses.currentSalaryYen,
      estimatedLow: diagnoses.estimatedSalaryLow,
      estimatedHigh: diagnoses.estimatedSalaryHigh,
      matchRank: diagnoses.matchRank,
    })
    .from(candidates)
    .leftJoin(candidateContacts, eq(candidateContacts.candidateId, candidates.id))
    .leftJoin(users, eq(candidates.salesUserId, users.id))
    .leftJoin(locations, eq(candidates.locationId, locations.id))
    .leftJoin(
      diagnoses,
      and(eq(diagnoses.candidateId, candidates.id), eq(diagnoses.status, "completed")),
    )
    .leftJoin(occupations, eq(diagnoses.currentOccupationId, occupations.id))
    .where(
      and(gte(candidates.createdAt, period.from), lte(candidates.createdAt, period.to)),
    )
    .orderBy(desc(candidates.createdAt))
    .limit(300);

  return (
    <>
      <PageHeader
        title="候補者一覧"
        description={`${period.label}｜匿名の診断開始時点から同一IDで追跡しています`}
        actions={<PeriodTabs active={period.key} />}
      />

      {rows.length === 0 ? (
        <EmptyState title="対象期間の候補者がいません" />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>獲得日</Th>
              <Th>ステージ</Th>
              <Th>ランク</Th>
              <Th>現職</Th>
              <Th className="text-right">現年収</Th>
              <Th className="text-right">想定年収</Th>
              <Th>営業担当</Th>
              <Th>獲得場所</Th>
              <Th>個人情報</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <Td className="text-ink-500">
                  {row.createdAt.toLocaleDateString("ja-JP", {
                    month: "numeric",
                    day: "numeric",
                  })}
                </Td>
                <Td>
                  <Badge tone={row.qualified ? "positive" : "neutral"}>
                    {labelOf(CANDIDATE_STAGE_LABELS, row.stage)}
                  </Badge>
                </Td>
                <Td>
                  <RankBadge rank={row.matchRank} />
                </Td>
                <Td>{row.occupationName ?? "—"}</Td>
                <NumTd>{formatManYen(row.currentSalary)}</NumTd>
                <NumTd>{formatManRange(row.estimatedLow, row.estimatedHigh)}</NumTd>
                <Td>{row.salesName ?? "直接流入"}</Td>
                <Td>{row.venueName ?? "—"}</Td>
                <Td className="text-ink-500">{row.hasContact ? "登録済み" : "匿名"}</Td>
                <Td>
                  <Link
                    href={`/admin/candidates/${row.id}`}
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
