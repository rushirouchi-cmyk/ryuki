import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, RankBadge } from '@/components/ui';
import type { DiagnosisResult } from '@/domain/diagnosis/types';
import { getCandidateByPublicToken } from '@/server/services/candidates';
import { getLatestDiagnosis } from '@/server/services/diagnosis';
import { formatManYen, formatSalaryRange } from '@/lib/format';

export const dynamic = 'force-dynamic';

const RANK_COPY: Record<string, { label: string; description: string }> = {
  S: { label: '非常に高い', description: '複数の職種で高い評価が見込めます。' },
  A: { label: '高い', description: '経験を活かせる求人が多いレンジです。' },
  B: { label: '可能性あり', description: '条件次第で年収アップが狙えます。' },
  C: { label: '限定的', description: '現時点では大きな伸びしろは限定的です。' },
};

export default async function DiagnosisResultPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const candidate = await getCandidateByPublicToken(token);
  if (!candidate) notFound();

  const diagnosis = await getLatestDiagnosis(candidate.id);
  if (!diagnosis?.result) notFound();

  const result = diagnosis.result as unknown as DiagnosisResult;
  const rankCopy = RANK_COPY[result.valueRank] ?? RANK_COPY.B;
  const upsideLow = Math.max(0, result.improvementLow);
  const upsideHigh = Math.max(0, result.improvementHigh);
  const hasUpside = upsideHigh > 0;
  const adjacent = result.adjacentOptions.slice(0, 3);
  const upsideOptions = result.upsideOptions.filter((o) => (o.expectedUpside ?? 0) > 0).slice(0, 3);

  return (
    <main className="mx-auto min-h-screen max-w-md bg-white pb-28">
      <header className="bg-gradient-to-b from-brand-700 to-brand-600 px-6 pt-10 pb-8 text-white">
        <p className="text-xs font-semibold tracking-widest text-brand-100">診断結果</p>
        <h1 className="mt-2 text-2xl font-bold">あなたの年収の伸びしろ</h1>

        <div className="mt-6 rounded-2xl bg-white/10 p-5 backdrop-blur">
          <p className="text-xs text-brand-100">転職時の想定年収レンジ</p>
          <p className="tabular mt-1 text-3xl font-bold">
            {formatSalaryRange(result.estimatedSalaryLow, result.estimatedSalaryHigh)}
          </p>
          <div className="mt-4 flex items-end justify-between border-t border-white/20 pt-4">
            <div>
              <p className="text-xs text-brand-100">現在年収</p>
              <p className="tabular text-lg font-semibold">{formatManYen(result.currentSalary)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-brand-100">年収改善余地</p>
              <p className="tabular text-lg font-bold text-emerald-300">
                {hasUpside
                  ? `+${Math.round(upsideLow / 10_000).toLocaleString('ja-JP')}〜${Math.round(upsideHigh / 10_000).toLocaleString('ja-JP')}万円`
                  : '現職の水準が市場相場です'}
              </p>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-6 -mt-4 flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <RankBadge rank={result.valueRank} size="lg" />
        <div>
          <p className="text-xs text-ink-500">市場価値ランク</p>
          <p className="text-lg font-bold text-ink-900">{rankCopy?.label}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{rankCopy?.description}</p>
        </div>
      </section>

      {(result.valuedSkills.length > 0 || result.valuedCertifications.length > 0) && (
        <section className="mt-8 px-6">
          <h2 className="text-sm font-bold text-ink-900">評価されやすい経験・資格</h2>
          <p className="mt-1 text-xs text-ink-500">求人側が高く評価しやすいポイントです。</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {result.valuedSkills.map((skill) => (
              <li key={skill.id}>
                <Badge tone="brand">{skill.name}</Badge>
              </li>
            ))}
            {result.valuedCertifications.map((cert) => (
              <li key={cert.id}>
                <Badge tone="success">{cert.name}</Badge>
              </li>
            ))}
          </ul>
        </section>
      )}

      {upsideOptions.length > 0 && (
        <section className="mt-8 px-6">
          <h2 className="text-sm font-bold text-ink-900">年収アップを狙いやすい職種</h2>
          <ol className="mt-3 space-y-3">
            {upsideOptions.map((option, index) => (
              <li key={option.occupationId} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-ink-900">
                      <span className="mr-2 text-brand-600">{index + 1}</span>
                      {option.occupationName}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {option.occupationCategory}
                      {option.isCurrentOccupation && '・現在の職種'}
                    </p>
                  </div>
                  <Badge tone={option.matchScore >= 70 ? 'success' : 'neutral'}>
                    適合度 {option.matchScore}
                  </Badge>
                </div>
                {option.benchmark && (
                  <p className="tabular mt-3 text-xs text-ink-700">
                    市場年収レンジ{' '}
                    <strong className="font-semibold">
                      {formatSalaryRange(option.benchmark.salaryLow, option.benchmark.salaryHigh)}
                    </strong>
                  </p>
                )}
                {option.expectedUpside !== null && option.expectedUpside > 0 && (
                  <p className="tabular mt-1 text-xs font-semibold text-emerald-600">
                    想定 +{Math.round(option.expectedUpside / 10_000).toLocaleString('ja-JP')}万円
                  </p>
                )}
                {option.notes && <p className="mt-2 text-xs leading-relaxed text-ink-500">{option.notes}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}

      {adjacent.length > 0 && (
        <section className="mt-8 px-6">
          <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5">
            <h2 className="text-sm font-bold text-brand-800">
              条件次第では、現在の職種以外にも転職の可能性があります
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-brand-800">
              あなたの経験は{' '}
              <strong className="font-semibold">
                {adjacent.map((option) => option.occupationName).join('・')}
              </strong>{' '}
              でも評価されやすい傾向があります。
            </p>
          </div>
        </section>
      )}

      <section className="mt-8 px-6">
        <h2 className="text-sm font-bold text-ink-900">現在の職種の市場水準</h2>
        <p className="tabular mt-2 text-sm text-ink-700">
          {result.currentOccupationName} / 経験 {result.experienceBand} 年:{' '}
          <strong className="font-semibold">{formatManYen(result.currentMarketMedian)}</strong>（中央値）
        </p>
      </section>

      <section className="mt-8 px-6">
        <p className="rounded-xl bg-slate-50 px-4 py-3 text-[11px] leading-relaxed text-ink-500">
          本診断は、職種別の市場年収データ・キャリア遷移ルール・ご回答内容にもとづく
          <strong className="font-semibold">推定値</strong>
          であり、年収や転職の成功を保証するものではありません。実際の提示年収は企業・時期・選考結果により異なります。
          {result.warnings.map((warning) => (
            <span key={warning} className="mt-1 block text-amber-700">
              {warning}
            </span>
          ))}
        </p>
      </section>

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
        <Link
          href={`/candidate/${token}`}
          className="block w-full rounded-xl bg-brand-600 px-5 py-4 text-center text-base font-semibold text-white transition-colors hover:bg-brand-700"
        >
          もっと詳しい診断・求人紹介を希望する
        </Link>
        <p className="mt-2 text-center text-[11px] text-ink-500">
          ここから先はご希望の方のみ。連絡先を登録するとキャリア面談に進めます。
        </p>
      </div>
    </main>
  );
}
