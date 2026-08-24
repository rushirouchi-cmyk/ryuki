import { desc, eq } from "drizzle-orm";
import { agentCompanies, referrals } from "@/lib/db/schema";
import { Card } from "@/components/ui";
import { loadBooking, loadCandidate } from "../data";

export default async function DonePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const { db, candidate } = await loadCandidate(token);

  const rows = await db
    .select({ name: agentCompanies.name, referredAt: referrals.referredAt })
    .from(referrals)
    .innerJoin(agentCompanies, eq(referrals.agentCompanyId, agentCompanies.id))
    .where(eq(referrals.candidateId, candidate.id))
    .orderBy(desc(referrals.referredAt));

  const booking = await loadBooking(candidate.id);

  return (
    <main className="px-5 pb-16 pt-12">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-positive text-2xl text-white">
        ✓
      </div>
      <h1 className="mt-5 text-2xl font-bold text-ink-900">お手続きが完了しました</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-600">
        ご選択いただいたエージェントに情報を提供しました。担当者から連絡がありますので、しばらくお待ちください。
      </p>

      {booking ? (
        <Card className="mt-6">
          <h2 className="text-sm font-semibold text-ink-500">キャリア面談</h2>
          <p className="mt-1 font-semibold text-ink-900">
            {booking.scheduledAt.toLocaleString("ja-JP", {
              month: "numeric",
              day: "numeric",
              weekday: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </Card>
      ) : null}

      <Card className="mt-4">
        <h2 className="text-sm font-semibold text-ink-500">情報提供先</h2>
        <ul className="mt-2 space-y-1">
          {rows.map((row) => (
            <li key={row.name} className="text-sm font-medium text-ink-800">
              {row.name}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-500">
          同意の撤回をご希望の場合は、担当のキャリアアドバイザーまでご連絡ください。
        </p>
      </Card>
    </main>
  );
}
