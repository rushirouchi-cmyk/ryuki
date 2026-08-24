import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-5 py-24 text-center">
      <p className="text-lg font-bold text-ink-900">ページが見つかりません</p>
      <p className="mt-2 text-sm text-ink-600">
        URLが変更されたか、アクセス権がない可能性があります。
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white"
      >
        トップへ戻る
      </Link>
    </main>
  );
}
