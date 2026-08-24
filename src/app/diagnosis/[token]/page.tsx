import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { loadCandidate, loadLatestDiagnosis } from "./data";
import { StartButton } from "./start-button";

export default async function DiagnosisLandingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const { candidate } = await loadCandidate(token);

  const existing = await loadLatestDiagnosis(candidate.id);
  if (existing) redirect(`/diagnosis/${token}/result`);

  return (
    <main className="px-5 pb-16 pt-10">
      <p className="text-sm font-semibold text-brand-600">無料・匿名・約90秒</p>
      <h1 className="mt-3 text-3xl leading-snug font-bold text-ink-900">
        あなたの経験、
        <br />
        今より年収が上がる
        <br />
        可能性があります。
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-ink-600">
        今のお仕事の経験・スキル・資格から、市場での想定年収と、年収を上げやすい職種を診断します。
      </p>

      <ul className="mt-6 space-y-2">
        {[
          "氏名・電話番号なしで診断できます",
          "質問は選ぶだけ・全16問",
          "診断結果はその場で表示されます",
        ].map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-ink-700">
            <span aria-hidden className="mt-0.5 text-brand-500">
              ✓
            </span>
            {item}
          </li>
        ))}
      </ul>

      <Card className="mt-8 bg-brand-50/60">
        <p className="text-sm font-semibold text-ink-800">診断でわかること</p>
        <dl className="mt-3 space-y-2 text-sm text-ink-700">
          <div className="flex justify-between gap-3">
            <dt>転職時の想定年収レンジ</dt>
            <dd className="font-semibold">510〜580万円 など</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>年収の改善余地</dt>
            <dd className="font-semibold">+80〜150万円 など</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>市場価値ランク</dt>
            <dd className="font-semibold">S / A / B / C</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>年収を上げやすい職種</dt>
            <dd className="font-semibold">最大3職種</dd>
          </div>
        </dl>
      </Card>

      <div className="sticky bottom-4 mt-8">
        <StartButton token={token} />
        <p className="mt-3 text-center text-xs text-ink-500">
          診断結果は統計データにもとづく推定値です。年収を保証するものではありません。
        </p>
      </div>
    </main>
  );
}
