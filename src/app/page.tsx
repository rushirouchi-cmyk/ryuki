import Link from 'next/link';

const ENTRY_POINTS = [
  { href: '/login', title: 'ログイン', description: 'Admin / Sales / Agent 共通のログイン画面' },
  { href: '/admin', title: 'Admin', description: 'ファネル・地域・営業・エージェント分析と各種設定' },
  { href: '/sales', title: 'Sales', description: 'シフト開始、QR発行、声掛けカウンター、当日インセンティブ' },
  { href: '/agent', title: 'Agent', description: '自社へ送客された候補者の進捗・成果登録' },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <p className="text-xs font-semibold tracking-widest text-brand-600">CAREER ROUTING ENGINE</p>
      <h1 className="mt-3 text-3xl font-bold text-ink-900">
        街頭営業を、再現可能なユーザー獲得チャネルに。
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-ink-700">
        匿名の年収アップ可能性診断から、キャリア面談、転職エージェント送客、入社・売上までを
        1人の候補者IDで一気通貫に追跡します。
      </p>

      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        {ENTRY_POINTS.map((entry) => (
          <Link
            key={entry.href}
            href={entry.href}
            className="rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-brand-400 hover:bg-brand-50/40"
          >
            <p className="text-sm font-semibold text-ink-900">{entry.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-500">{entry.description}</p>
          </Link>
        ))}
      </div>

      <p className="mt-10 text-xs text-ink-500">
        候補者向けの診断は営業担当が発行するQRコード（<code className="rounded bg-slate-200 px-1">/d/&#123;token&#125;</code>）から開始します。
      </p>
    </main>
  );
}
