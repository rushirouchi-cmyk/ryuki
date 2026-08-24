import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Card, LinkButton } from "@/components/ui";
import { MATCH_RANK_LABELS } from "@/lib/utils/labels";
import { formatManRange, formatManYen, formatUpliftRange } from "@/lib/utils/format";
import { loadCandidate, loadContact, loadLatestDiagnosis } from "../data";

const RANK_TONE = {
  S: "brand",
  A: "positive",
  B: "caution",
  C: "neutral",
} as const;

export default async function ResultPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const { candidate } = await loadCandidate(token);
  const result = await loadLatestDiagnosis(candidate.id);
  if (!result) redirect(`/diagnosis/${token}`);

  const { diagnosis, currentOccupation, careerOptions } = result;
  const contact = await loadContact(candidate.id);
  const rank = diagnosis.matchRank ?? "C";
  const valued = diagnosis.valuedExperiences ?? [];
  const hasUplift = (diagnosis.upliftHigh ?? 0) > 0;

  return (
    <main className="px-5 pb-44 pt-8">
      <p className="text-sm font-semibold text-brand-600">診断結果</p>
      <h1 className="mt-1 text-2xl font-bold text-ink-900">
        {hasUplift
          ? "今より年収が上がる可能性があります"
          : "現在の年収は市場水準に近い状態です"}
      </h1>

      <Card className="mt-6">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-ink-500">現在の年収</span>
          <span className="tabular text-lg font-semibold text-ink-700">
            {formatManYen(diagnosis.currentSalaryYen)}
          </span>
        </div>

        <div className="mt-4 rounded-2xl bg-brand-50 px-4 py-4">
          <p className="text-sm font-medium text-brand-700">転職時の想定年収レンジ</p>
          <p className="tabular mt-1 text-3xl font-bold text-brand-800">
            {formatManRange(diagnosis.estimatedSalaryLow, diagnosis.estimatedSalaryHigh)}
          </p>
          <p className="mt-3 text-sm font-medium text-ink-600">年収の改善余地</p>
          <p className="tabular text-xl font-bold text-positive">
            {formatUpliftRange(diagnosis.upliftLow, diagnosis.upliftHigh)}
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-ink-500">市場価値ランク</span>
          <span className="flex items-center gap-2">
            <Badge tone={RANK_TONE[rank]} className="text-base">
              {rank}
            </Badge>
            <span className="text-sm font-semibold text-ink-700">
              {MATCH_RANK_LABELS[rank]}
            </span>
          </span>
        </div>
      </Card>

      {valued.length > 0 ? (
        <Card className="mt-4">
          <h2 className="text-sm font-semibold text-ink-500">評価されやすい経験</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {valued.map((item) => (
              <li
                key={item}
                className="rounded-full bg-ink-100 px-3 py-1.5 text-sm font-medium text-ink-700"
              >
                {item}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {careerOptions.length > 0 ? (
        <Card className="mt-4">
          <h2 className="text-sm font-semibold text-ink-500">年収アップを狙いやすい職種</h2>
          <ol className="mt-3 space-y-3">
            {careerOptions.map((option, index) => (
              <li key={option.occupationId} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-ink-900">{option.occupationName}</p>
                  {option.description ? (
                    <p className="mt-0.5 text-xs text-ink-500">{option.description}</p>
                  ) : null}
                  <p className="tabular mt-1 text-sm text-ink-600">
                    市場年収 {formatManRange(option.salaryLow, option.salaryHigh)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-4 rounded-xl bg-ink-100 px-3 py-2.5 text-sm text-ink-700">
            あなたの場合、条件次第では
            {currentOccupation ? `「${currentOccupation.occupationName}」` : "現在の職種"}
            以外にも転職できる可能性があります。
          </p>
        </Card>
      ) : (
        <Card className="mt-4">
          <h2 className="text-sm font-semibold text-ink-500">想定年収レンジの根拠</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-600">
            {currentOccupation
              ? `上記のレンジは、現在のご経験（${currentOccupation.occupationName}）の市場年収水準にもとづく推定です。`
              : "上記のレンジは、現在のご経験の市場年収水準にもとづく推定です。"}
            現時点のご回答からは、条件に合う近接職種を特定できませんでした。キャリア面談では、より詳しくお伺いしたうえで、
            転職可能性のある職種をご提案します。
          </p>
        </Card>
      )}

      <p className="mt-5 text-xs leading-relaxed text-ink-500">
        ※ 本結果は市場年収データと入力内容にもとづく推定値であり、転職後の年収を保証するものではありません。
        実際の提示年収は企業・選考結果により異なります。
      </p>

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md border-t border-ink-200 bg-white/95 px-5 py-4 backdrop-blur">
        {contact ? (
          <LinkButton href={`/diagnosis/${token}/booking`} size="lg" full>
            キャリア面談を予約する
          </LinkButton>
        ) : (
          <>
            <LinkButton href={`/diagnosis/${token}/register`} size="lg" full>
              もっと詳しい診断・求人紹介を受け取る
            </LinkButton>
            <p className="mt-2 text-center text-xs text-ink-500">
              ここまでは匿名のままです。ご希望の方のみ連絡先をご登録ください。
            </p>
          </>
        )}
      </div>

      <p className="mt-6 text-center">
        <Link href={`/diagnosis/${token}`} className="text-xs text-ink-400 underline">
          診断トップへ
        </Link>
      </p>
    </main>
  );
}
