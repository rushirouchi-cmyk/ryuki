import { SubmitButton } from '@/components/ui/forms';
import { beginDiagnosisAction } from './actions';

const POINTS = [
  { icon: '⏱', title: '約90秒', body: '15問のかんたんな選択式。フリー入力はほとんどありません。' },
  { icon: '🔒', title: '匿名・無料', body: '氏名・電話番号なしで診断できます。' },
  { icon: '📈', title: '年収の伸びしろがわかる', body: '今の経験で狙える職種と想定年収レンジを表示します。' },
];

export default async function DiagnosisLandingPage({
  searchParams,
}: {
  searchParams: Promise<{ qr?: string }>;
}) {
  const { qr } = await searchParams;

  return (
    <main className="mx-auto min-h-screen max-w-md bg-white px-6 py-10">
      {qr === 'expired' && (
        <p className="mb-6 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
          このQRコードは受付を終了しています。診断はこのまま無料でご利用いただけます。
        </p>
      )}

      <p className="text-xs font-semibold tracking-widest text-brand-600">無料・匿名の年収診断</p>
      <h1 className="mt-3 text-[28px] leading-tight font-bold text-ink-900">
        あなたの経験、
        <br />
        今より年収が
        <br />
        上がる可能性があります。
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-ink-700">
        整備・設備保全・電気工事などの技術職の方は、
        <strong className="font-semibold">今の職種以外にも転職できる選択肢</strong>
        があります。市場データをもとに、想定年収レンジと狙いやすい職種を診断します。
      </p>

      <ul className="mt-8 space-y-3">
        {POINTS.map((point) => (
          <li key={point.title} className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <span aria-hidden className="text-xl">
              {point.icon}
            </span>
            <span>
              <span className="block text-sm font-semibold text-ink-900">{point.title}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">{point.body}</span>
            </span>
          </li>
        ))}
      </ul>

      <form action={beginDiagnosisAction} className="sticky bottom-4 mt-8">
        <SubmitButton size="lg" pendingLabel="準備中...">
          90秒の診断をはじめる
        </SubmitButton>
      </form>

      <p className="mt-4 text-center text-[11px] leading-relaxed text-ink-500">
        診断結果は公的統計・求人データ等をもとにした推定値であり、年収を保証するものではありません。
        <br />
        個人情報の入力は診断結果を見たあと、ご希望の方のみです。
      </p>
    </main>
  );
}
