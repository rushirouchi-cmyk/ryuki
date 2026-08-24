export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-12">
      <h1 className="text-xl font-bold text-ink-900">個人情報の取扱いについて（プレースホルダー）</h1>
      <p className="mt-4 text-sm leading-relaxed text-ink-700">
        本ページはMVP検証用のプレースホルダーです。実運用にあたっては、個人情報保護法にもとづく
        利用目的、第三者提供、開示・訂正・利用停止の請求手続、問い合わせ窓口を記載してください。
      </p>
      <ul className="mt-6 list-disc space-y-2 pl-5 text-sm text-ink-700">
        <li>取得する情報: 氏名、メールアドレス、電話番号、生年、勤務地、診断回答内容</li>
        <li>利用目的: キャリア相談および転職支援サービスの提供</li>
        <li>第三者提供: ご本人が選択した転職エージェントに対してのみ、明示的な同意取得後に実施</li>
        <li>保管期間: 利用目的の達成に必要な期間</li>
      </ul>
    </main>
  );
}
