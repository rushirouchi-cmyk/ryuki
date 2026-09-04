import Link from 'next/link';
import { PageHeader } from '@/components/ui';

/** 権限不足時の表示 (§49)。エラーではなく、何ができるかを示す。 */
export function Forbidden({ needed }: { needed?: string }) {
  return (
    <>
      <PageHeader title="この画面を表示する権限がありません" />
      <div className="p-6">
        <div className="rounded-md border border-warn-line bg-warn-bg p-4 text-xs text-warn-fg">
          <p>△ お使いのアカウントの権限では、この画面を開けません。</p>
          {needed && <p className="mt-1 opacity-80">必要な権限: {needed}</p>}
          <p className="mt-2">
            権限の変更が必要な場合は管理者にご連絡ください。
            <Link href="/" className="ml-2 underline">
              自分のダッシュボードへ戻る
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
