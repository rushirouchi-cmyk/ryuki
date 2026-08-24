import Link from "next/link";
import { and, count, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { referrals } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guards";
import { Card, CardTitle, EmptyState, LinkButton, PageHeader, StatTile } from "@/components/ui";
import { formatManYen, formatNumber, formatPercent, safeDivide } from "@/lib/utils/format";
import { REFERRAL_STATUS_LABELS, labelOf } from "@/lib/utils/labels";

export default async function AgentHomePage() {
  const user = await requireRole("agent");
  const companyId = user.agentCompanyId;
  if (companyId === null) {
    return <EmptyState title="所属エージェント企業が設定されていません" />;
  }

  const db = await getDb();
  const [summary] = await db
    .select({
      total: count(),
      pending: sql<number>`count(*) filter (where ${referrals.status} = 'pending')::int`,
      accepted: sql<number>`count(*) filter (where ${referrals.acceptedAt} is not null)::int`,
      interviewCompleted: sql<number>`count(*) filter (where ${referrals.interviewCompletedAt} is not null)::int`,
      offers: sql<number>`count(*) filter (where ${referrals.offerAt} is not null)::int`,
      joined: sql<number>`count(*) filter (where ${referrals.joinedAt} is not null)::int`,
      avgOffer: sql<number | null>`avg(${referrals.offerSalaryYen})`,
    })
    .from(referrals)
    .where(eq(referrals.agentCompanyId, companyId));

  const needsAction = await db
    .select({
      id: referrals.id,
      status: referrals.status,
      referredAt: referrals.referredAt,
    })
    .from(referrals)
    .where(
      and(eq(referrals.agentCompanyId, companyId), eq(referrals.status, "pending")),
    )
    .orderBy(referrals.referredAt)
    .limit(10);

  return (
    <>
      <PageHeader
        title="サマリー"
        description={`${user.agentCompanyName ?? ""}に紹介された候補者のみ表示されます`}
        actions={<LinkButton href="/agent/candidates">候補者一覧</LinkButton>}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="紹介総数" value={formatNumber(summary?.total ?? 0)} />
        <StatTile label="未対応" value={formatNumber(summary?.pending ?? 0)} tone="brand" />
        <StatTile label="受諾" value={formatNumber(summary?.accepted ?? 0)} />
        <StatTile
          label="面談実施"
          value={formatNumber(summary?.interviewCompleted ?? 0)}
        />
        <StatTile label="内定" value={formatNumber(summary?.offers ?? 0)} />
        <StatTile
          label="入社"
          value={formatNumber(summary?.joined ?? 0)}
          tone="positive"
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <StatTile
          label="内定率"
          value={formatPercent(safeDivide(summary?.offers ?? 0, summary?.total ?? 0))}
        />
        <StatTile
          label="入社率"
          value={formatPercent(safeDivide(summary?.joined ?? 0, summary?.offers ?? 0))}
        />
        <StatTile
          label="平均提示年収"
          value={formatManYen(summary?.avgOffer ? Number(summary.avgOffer) : null)}
        />
      </div>

      <section className="mt-8">
        <CardTitle>対応待ちの紹介</CardTitle>
        <div className="mt-2 space-y-2">
          {needsAction.length === 0 ? (
            <EmptyState
              title="対応待ちの候補者はいません"
              description="新しい紹介が届くとここに表示されます。"
            />
          ) : (
            needsAction.map((referral) => (
              <Link
                key={referral.id}
                href={`/agent/candidates/${referral.id}`}
                className="block"
              >
                <Card className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-semibold text-ink-800">
                      紹介 #{referral.id}
                    </p>
                    <p className="text-xs text-ink-500">
                      {referral.referredAt.toLocaleString("ja-JP")}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-brand-600">
                    {labelOf(REFERRAL_STATUS_LABELS, referral.status)} →
                  </span>
                </Card>
              </Link>
            ))
          )}
        </div>
      </section>
    </>
  );
}
