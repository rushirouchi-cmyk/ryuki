import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { loadAgentCandidate } from "@/lib/domain/agents/views";
import { Badge, Card, CardTitle, PageHeader, RankBadge } from "@/components/ui";
import { MATCH_RANK_LABELS, REFERRAL_STATUS_LABELS, labelOf } from "@/lib/utils/labels";
import { formatManRange, formatManYen } from "@/lib/utils/format";
import { DIAGNOSIS_TIMING_LABELS } from "./labels";
import { StatusForm } from "./status-form";

export default async function AgentCandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("agent");
  const companyId = user.agentCompanyId;
  if (companyId === null) notFound();

  const { id } = await params;
  const referralId = Number(id);
  if (!Number.isInteger(referralId)) notFound();

  const db = await getDb();
  const card = await loadAgentCandidate(db, companyId, referralId);
  if (!card) notFound();

  return (
    <>
      <PageHeader
        title={card.contact?.fullName ?? `紹介 #${card.referralId}`}
        description={`紹介日 ${card.referredAt.toLocaleString("ja-JP")}`}
        actions={
          <Badge tone={card.status === "joined" ? "positive" : "brand"}>
            {labelOf(REFERRAL_STATUS_LABELS, card.status)}
          </Badge>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle>候補者情報</CardTitle>
          <div className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Row label="年齢">{card.age ? `${card.age}歳` : "—"}</Row>
            <Row label="現在の勤務地">{card.currentRegion ?? "—"}</Row>
            <Row label="現職">{card.currentOccupation ?? "—"}</Row>
            <Row label="経験年数">
              {card.experienceYears !== null ? `${card.experienceYears}年` : "—"}
            </Row>
            <Row label="現年収">{formatManYen(card.currentSalaryYen)}</Row>
            <Row label="市場年収レンジ">
              {formatManRange(card.estimatedSalaryLow, card.estimatedSalaryHigh)}
            </Row>
            <Row label="市場価値ランク">
              <span className="flex items-center justify-end gap-2">
                <RankBadge rank={card.matchRank} />
                <span className="text-xs text-ink-500">
                  {card.matchRank ? MATCH_RANK_LABELS[card.matchRank] : ""}
                </span>
              </span>
            </Row>
            <Row label="転職時期">
              {card.desiredTiming
                ? (DIAGNOSIS_TIMING_LABELS[card.desiredTiming] ?? card.desiredTiming)
                : "—"}
            </Row>
            <Row label="希望勤務地">
              {card.desiredRegions.length > 0 ? card.desiredRegions.join("・") : "—"}
            </Row>
          </div>

          <div className="mt-4 border-t border-ink-100 pt-3">
            <p className="text-xs font-semibold text-ink-500">推奨職種</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {card.recommendedOccupations.length === 0 ? (
                <li className="text-sm text-ink-500">—</li>
              ) : (
                card.recommendedOccupations.map((name) => (
                  <li
                    key={name}
                    className="rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700"
                  >
                    {name}
                  </li>
                ))
              )}
            </ul>
          </div>
        </Card>

        <Card>
          <CardTitle>連絡先</CardTitle>
          {card.contact ? (
            <div className="mt-3 space-y-2 text-sm">
              <Row label="氏名">{card.contact.fullName}</Row>
              <Row label="メール">
                <a
                  href={`mailto:${card.contact.email}`}
                  className="text-brand-600 hover:underline"
                >
                  {card.contact.email}
                </a>
              </Row>
              <Row label="電話">{card.contact.phone ?? "—"}</Row>
              <p className="mt-3 rounded-lg bg-ink-50 p-2 text-xs text-ink-500">
                候補者本人の第三者提供同意にもとづき開示されています。
              </p>
            </div>
          ) : (
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              候補者の同意が確認できないため、連絡先は表示できません。
            </p>
          )}
        </Card>
      </div>

      <section className="mt-8">
        <CardTitle>進捗と成果の登録</CardTitle>
        <div className="mt-2">
          <StatusForm
            referralId={card.referralId}
            currentStatus={card.status}
            offerCompany={card.offerCompany}
            offerJobTitle={card.offerJobTitle}
            offerSalaryYen={card.offerSalaryYen}
            offerDate={card.offerDate}
            joinedDate={card.joinedDate}
            notes={card.notes}
          />
        </div>
      </section>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-ink-100 pb-1.5">
      <dt className="shrink-0 text-ink-500">{label}</dt>
      <dd className="break-all text-right font-medium text-ink-900">{children}</dd>
    </div>
  );
}
