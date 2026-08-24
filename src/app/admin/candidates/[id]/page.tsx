import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  agentCompanies,
  candidateContacts,
  candidateEvents,
  candidates,
  consents,
  diagnoses,
  diagnosisOccupationMatches,
  incentiveLedger,
  locations,
  occupations,
  referrals,
  revenueEvents,
  users,
} from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guards";
import {
  Badge,
  Card,
  CardTitle,
  NumTd,
  PageHeader,
  RankBadge,
  TableWrap,
  Td,
  Th,
} from "@/components/ui";
import {
  CANDIDATE_EVENT_LABELS,
  CANDIDATE_STAGE_LABELS,
  INCENTIVE_EVENT_LABELS,
  MATCH_RANK_LABELS,
  REFERRAL_STATUS_LABELS,
  labelOf,
} from "@/lib/utils/labels";
import { formatManRange, formatManYen, formatYen } from "@/lib/utils/format";
import { AttributionForm } from "./attribution-form";

export default async function CandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin");
  const { id } = await params;
  const db = await getDb();

  const [row] = await db
    .select({
      candidate: candidates,
      salesName: users.name,
      venueName: locations.venueName,
    })
    .from(candidates)
    .leftJoin(users, eq(candidates.salesUserId, users.id))
    .leftJoin(locations, eq(candidates.locationId, locations.id))
    .where(eq(candidates.id, id))
    .limit(1);
  if (!row) notFound();

  const [contact] = await db
    .select()
    .from(candidateContacts)
    .where(eq(candidateContacts.candidateId, id))
    .limit(1);

  const [diagnosis] = await db
    .select()
    .from(diagnoses)
    .where(and(eq(diagnoses.candidateId, id), eq(diagnoses.status, "completed")))
    .orderBy(desc(diagnoses.completedAt))
    .limit(1);

  const matches = diagnosis
    ? await db
        .select({
          occupationName: occupations.name,
          isCurrent: diagnosisOccupationMatches.isCurrent,
          matchScore: diagnosisOccupationMatches.matchScore,
          breakdown: diagnosisOccupationMatches.scoreBreakdown,
          salaryLow: diagnosisOccupationMatches.salaryLow,
          salaryHigh: diagnosisOccupationMatches.salaryHigh,
          rankOrder: diagnosisOccupationMatches.rankOrder,
        })
        .from(diagnosisOccupationMatches)
        .innerJoin(
          occupations,
          eq(diagnosisOccupationMatches.occupationId, occupations.id),
        )
        .where(eq(diagnosisOccupationMatches.diagnosisId, diagnosis.id))
        .orderBy(diagnosisOccupationMatches.rankOrder)
    : [];

  const [events, referralRows, consentRows, ledgerRows, revenueRows, salesUsers] =
    await Promise.all([
      db
        .select()
        .from(candidateEvents)
        .where(eq(candidateEvents.candidateId, id))
        .orderBy(candidateEvents.createdAt),
      db
        .select({ referral: referrals, agentName: agentCompanies.name })
        .from(referrals)
        .innerJoin(agentCompanies, eq(referrals.agentCompanyId, agentCompanies.id))
        .where(eq(referrals.candidateId, id)),
      db
        .select({ consent: consents, agentName: agentCompanies.name })
        .from(consents)
        .innerJoin(agentCompanies, eq(consents.agentCompanyId, agentCompanies.id))
        .where(eq(consents.candidateId, id)),
      db
        .select()
        .from(incentiveLedger)
        .where(eq(incentiveLedger.candidateId, id))
        .orderBy(incentiveLedger.occurredAt),
      db
        .select()
        .from(revenueEvents)
        .where(eq(revenueEvents.candidateId, id))
        .orderBy(revenueEvents.occurredAt),
      db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(and(eq(users.role, "sales"), eq(users.active, true)))
        .orderBy(users.name),
    ]);

  const incentiveTotal = ledgerRows
    .filter((entry) => entry.status !== "rejected")
    .reduce((sum, entry) => sum + entry.amountYen, 0);
  const revenueTotal = revenueRows
    .filter((entry) => entry.status === "confirmed")
    .reduce((sum, entry) => sum + entry.amountYen, 0);

  return (
    <>
      <PageHeader
        title={contact?.fullName ?? "匿名候補者"}
        description={`ID ${row.candidate.id}`}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardTitle>獲得（Acquisition）</CardTitle>
          <dl className="mt-3 space-y-1.5 text-sm">
            <Row label="ステージ">
              <Badge tone={row.candidate.qualified ? "positive" : "neutral"}>
                {labelOf(CANDIDATE_STAGE_LABELS, row.candidate.stage)}
              </Badge>
            </Row>
            <Row label="営業担当">{row.salesName ?? "直接流入"}</Row>
            <Row label="獲得場所">{row.venueName ?? "—"}</Row>
            <Row label="紐づけ方法">{row.candidate.attributionSource}</Row>
            <Row label="紐づけ確定">
              {row.candidate.attributionLockedAt?.toLocaleString("ja-JP") ?? "未確定"}
            </Row>
            <Row label="獲得日時">
              {row.candidate.createdAt.toLocaleString("ja-JP")}
            </Row>
          </dl>
          <div className="mt-4 border-t border-ink-100 pt-3">
            <AttributionForm
              candidateId={row.candidate.id}
              currentSalesUserId={row.candidate.salesUserId}
              salesUsers={salesUsers}
            />
          </div>
        </Card>

        <Card>
          <CardTitle>診断（Diagnosis）</CardTitle>
          {diagnosis ? (
            <dl className="mt-3 space-y-1.5 text-sm">
              <Row label="市場価値ランク">
                <span className="flex items-center gap-2">
                  <RankBadge rank={diagnosis.matchRank} />
                  <span className="text-xs text-ink-500">
                    {diagnosis.matchRank
                      ? MATCH_RANK_LABELS[diagnosis.matchRank]
                      : ""}{" "}
                    / {diagnosis.bestMatchScore}点
                  </span>
                </span>
              </Row>
              <Row label="現在年収">{formatManYen(diagnosis.currentSalaryYen)}</Row>
              <Row label="想定年収レンジ">
                {formatManRange(
                  diagnosis.estimatedSalaryLow,
                  diagnosis.estimatedSalaryHigh,
                )}
              </Row>
              <Row label="改善余地">
                {formatManRange(diagnosis.upliftLow, diagnosis.upliftHigh)}
              </Row>
              <Row label="経験年数">{diagnosis.experienceYears ?? "—"}年</Row>
              <Row label="エンジン">
                {diagnosis.engineVersion} / データ信頼度 {diagnosis.dataConfidence}
              </Row>
              <Row label="評価された経験">
                {(diagnosis.valuedExperiences ?? []).join("・") || "—"}
              </Row>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-ink-500">診断は未完了です。</p>
          )}
        </Card>

        <Card>
          <CardTitle>個人情報（Conversion）</CardTitle>
          {contact ? (
            <dl className="mt-3 space-y-1.5 text-sm">
              <Row label="氏名">{contact.fullName}</Row>
              <Row label="メール">{contact.email}</Row>
              <Row label="電話">{contact.phone ?? "—"}</Row>
              <Row label="生年">{contact.birthYear ?? "—"}</Row>
              <Row label="登録日">{contact.createdAt.toLocaleDateString("ja-JP")}</Row>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-ink-500">
              まだ匿名です。個人情報は登録されていません。
            </p>
          )}
          <div className="mt-4 border-t border-ink-100 pt-3">
            <p className="text-xs font-semibold text-ink-500">第三者提供同意</p>
            {consentRows.length === 0 ? (
              <p className="mt-1 text-sm text-ink-500">同意履歴はありません。</p>
            ) : (
              <ul className="mt-1 space-y-1 text-sm">
                {consentRows.map(({ consent, agentName }) => (
                  <li key={consent.id}>
                    {agentName}｜{consent.consentedAt.toLocaleString("ja-JP")}｜
                    <span className="text-xs text-ink-500">{consent.contentVersion}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      {matches.length > 0 ? (
        <section className="mt-8">
          <CardTitle>職種別スコア内訳（説明可能性のための保存データ）</CardTitle>
          <div className="mt-2">
            <TableWrap>
              <thead>
                <tr>
                  <Th>職種</Th>
                  <Th className="text-right">スコア</Th>
                  <Th className="text-right">スキル</Th>
                  <Th className="text-right">資格</Th>
                  <Th className="text-right">経験</Th>
                  <Th className="text-right">勤務地</Th>
                  <Th className="text-right">条件</Th>
                  <Th className="text-right">学歴等</Th>
                  <Th className="text-right">転用係数</Th>
                  <Th className="text-right">要件減点</Th>
                  <Th className="text-right">市場年収</Th>
                  <Th>提示</Th>
                </tr>
              </thead>
              <tbody>
                {matches.map((match) => (
                  <tr key={match.occupationName}>
                    <Td className="font-medium">
                      {match.occupationName}
                      {match.isCurrent ? (
                        <span className="ml-2 text-xs text-ink-400">現職</span>
                      ) : null}
                    </Td>
                    <NumTd className="font-semibold">{match.matchScore}</NumTd>
                    <NumTd>{match.breakdown.skill}</NumTd>
                    <NumTd>{match.breakdown.certification}</NumTd>
                    <NumTd>{match.breakdown.experience}</NumTd>
                    <NumTd>{match.breakdown.location}</NumTd>
                    <NumTd>{match.breakdown.workingCondition}</NumTd>
                    <NumTd>{match.breakdown.profile}</NumTd>
                    <NumTd>{match.breakdown.transitionFactor}</NumTd>
                    <NumTd>{match.breakdown.requirementPenalty}</NumTd>
                    <NumTd>{formatManRange(match.salaryLow, match.salaryHigh)}</NumTd>
                    <Td>
                      {match.isCurrent
                        ? "—"
                        : match.rankOrder < 900
                          ? "提示"
                          : "非提示"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </div>
        </section>
      ) : null}

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <section>
          <CardTitle>送客とアウトカム</CardTitle>
          <div className="mt-2">
            {referralRows.length === 0 ? (
              <Card>
                <p className="text-sm text-ink-500">送客はまだありません。</p>
              </Card>
            ) : (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>エージェント</Th>
                    <Th>状態</Th>
                    <Th>提示企業</Th>
                    <Th className="text-right">提示年収</Th>
                    <Th>入社日</Th>
                  </tr>
                </thead>
                <tbody>
                  {referralRows.map(({ referral, agentName }) => (
                    <tr key={referral.id}>
                      <Td className="font-medium">{agentName}</Td>
                      <Td>{labelOf(REFERRAL_STATUS_LABELS, referral.status)}</Td>
                      <Td>{referral.offerCompany ?? "—"}</Td>
                      <NumTd>{formatManYen(referral.offerSalaryYen)}</NumTd>
                      <Td>{referral.joinedDate ?? "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Card>
              <p className="text-xs text-ink-500">この候補者からの確定売上</p>
              <p className="tabular mt-1 text-xl font-bold text-positive">
                {formatYen(revenueTotal)}
              </p>
            </Card>
            <Card>
              <p className="text-xs text-ink-500">支払インセンティブ</p>
              <p className="tabular mt-1 text-xl font-bold text-ink-900">
                {formatYen(incentiveTotal)}
              </p>
            </Card>
          </div>
        </section>

        <section>
          <CardTitle>イベント履歴（candidate_events）</CardTitle>
          <div className="mt-2">
            <TableWrap>
              <thead>
                <tr>
                  <Th>日時</Th>
                  <Th>イベント</Th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <Td className="text-ink-500">
                      {event.createdAt.toLocaleString("ja-JP")}
                    </Td>
                    <Td className="font-medium">
                      {labelOf(CANDIDATE_EVENT_LABELS, event.eventType)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </div>

          <CardTitle className="mt-6 block">インセンティブ明細</CardTitle>
          <div className="mt-2">
            <TableWrap>
              <thead>
                <tr>
                  <Th>成果</Th>
                  <Th className="text-right">金額</Th>
                  <Th>状態</Th>
                </tr>
              </thead>
              <tbody>
                {ledgerRows.map((entry) => (
                  <tr key={entry.id}>
                    <Td>{labelOf(INCENTIVE_EVENT_LABELS, entry.eventType)}</Td>
                    <NumTd>{formatYen(entry.amountYen)}</NumTd>
                    <Td className="text-ink-500">{entry.status}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </div>
        </section>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-ink-500">{label}</dt>
      <dd className="text-right font-medium text-ink-900">{children}</dd>
    </div>
  );
}
