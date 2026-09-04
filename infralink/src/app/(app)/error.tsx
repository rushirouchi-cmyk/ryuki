'use client';

/** 予期しないエラーの表示。業務が止まらないよう再試行導線を出す。 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="p-6">
      <div className="rounded-md border border-crit-line bg-crit-bg p-4 text-xs text-crit-fg">
        <p className="font-semibold">■ 画面の表示中にエラーが発生しました。</p>
        <p className="mt-1">{error.message}</p>
        {error.digest && <p className="mt-1 opacity-70">エラーID: {error.digest}</p>}
        <button onClick={reset} className="mt-3 rounded border border-crit-line bg-white px-2.5 py-1 font-medium">
          再試行
        </button>
      </div>
    </div>
  );
}
