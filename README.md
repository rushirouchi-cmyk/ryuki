# Career Routing Engine

街頭営業を起点に転職潜在層を獲得し、**匿名の年収アップ可能性診断 → キャリア面談 → 転職エージェント送客 → 内定・入社・売上**までを
一人の候補者IDで一気通貫に追跡する事業検証用MVPです。

単なる年収診断サイトではなく、内部的なコンセプトは以下の2つです。

1. **Career Routing Engine** — 経験・スキル・資格から、現職だけでなく転用可能な近接職種まで探索し、年収改善余地を診断して最適な支援先へルーティングする
2. **街頭営業の定量化** — 勘と根性の営業を、地域 × 曜日 × 時間帯 × 担当者で再現可能なユーザー獲得チャネルに変換する

---

## クイックスタート

前提: Node.js 20+ / PostgreSQL 14+

```bash
# 1. 依存関係
npm install

# 2. 環境変数
cp .env.example .env.local
#   DATABASE_URL を自分の PostgreSQL に向ける
#   （Supabase の接続文字列でもそのまま動作します）

# 3. スキーマ適用とシードデータ投入
npm run db:migrate
npm run db:seed

# 4. 起動
npm run dev     # http://localhost:3000
```

`npm run db:seed` は既存データを truncate してから、職種マスター・市場年収ベンチマーク・
8週間分のシフト・約800名の候補者（診断結果・送客・内定・入社まで）を投入します。
Admin ダッシュボードが初期状態から分析可能な状態になります。

### 検証用アカウント

パスワードはすべて `.env.local` の `SEED_PASSWORD`（既定値 `password123`）です。

| ロール | メールアドレス | 入口 |
| --- | --- | --- |
| Admin | `admin@example.com` | `/admin` |
| Sales | `sales1@example.com`（他に sales2 / sales3） | `/sales` |
| Agent | `agent1@example.com`（他に agent2 / agent3） | `/agent` |

Candidate 側は認証不要です。

---

## 主要画面

### Candidate（モバイル最優先・認証不要）

| URL | 内容 |
| --- | --- |
| `/d/{qrToken}` | QR着地。スキャンを記録し、初回のみ attribution を確定してLPへ転送 |
| `/diagnosis` | 診断LP（90秒・匿名・無料） |
| `/diagnosis/start` | 15問の匿名診断（1画面1問・進捗バー・選択式中心） |
| `/diagnosis/result/{token}` | 想定年収レンジ・改善余地・市場価値ランク・狙いやすい職種 |
| `/candidate/{token}` | 連絡先登録 → 面談予約 → エージェント選択 → 第三者提供同意 → 送客 |

QRトークンは個人情報を含みません。実際のQR画像は `/sales/shift` で発行されます。

### Sales（モバイル最優先）

| URL | 内容 |
| --- | --- |
| `/sales` | 本日の実績（声掛け〜送客）、暫定報酬、月次累計、ボーナスまでの残件数 |
| `/sales/shift` | 営業開始（場所・時間・天候・会場種別）、QR発行、声掛け／立ち止まりカウンター、シフト終了 |
| `/sales/incentives` | 自分のインセンティブ明細（承認ステータス別） |

カウンターは ±1 の両方を用意しており、誤タップをその場で修正できます。QRスキャン以降は自動集計です。

### Admin（PC中心・レスポンシブ）

| URL | 内容 |
| --- | --- |
| `/admin` | 今日/今週/今月/任意期間の獲得・転換率・ユニットエコノミクス |
| `/admin/funnel` | 声掛け→立ち止まり→QR→診断→リード→面談→有効→送客→内定→入社 |
| `/admin/areas` | 地域 / 会場種別 / 曜日 / 時間帯 / 天候の比較と Area Score |
| `/admin/sales` | 営業担当別の獲得効率・報酬・粗利/時間 |
| `/admin/agents` | エージェント別の受託率・面談実施率・決定率・平均提示年収 |
| `/admin/candidates` | 候補者一覧・詳細（イベント履歴、attribution修正） |
| `/admin/benchmarks` | 市場年収ベンチマークの登録・編集 |
| `/admin/diagnosis-settings` | 診断エンジンの重み・ランク閾値・丸め単位 |
| `/admin/incentive-settings` | インセンティブルールと承認（pending/approved/rejected/paid） |

### Agent

| URL | 内容 |
| --- | --- |
| `/agent` | 自社への送客サマリー |
| `/agent/candidates` | 自社に送客された候補者のみ（他社分は404） |
| `/agent/candidates/{referralId}` | ステータス更新と成果登録（提示年収・入社日） |

---

## アーキテクチャ

```
src/
├── domain/           ドメインロジック（純粋関数・DB非依存・テスト対象）
│   ├── diagnosis/      年収診断エンジン（説明可能なルールベース）
│   ├── incentive/      インセンティブ計算（重複防止・期間・条件）
│   ├── attribution/    first valid attribution の判定
│   ├── agent-routing/  エージェント推薦スコア
│   ├── analytics/      ファネル集計・ユニットエコノミクス・Area Score
│   ├── auth/           RBAC 判定・PIIマスキング
│   └── config/         業務ルールの型とデフォルト値（zod）
├── server/           DBアクセス・セッション・監査ログ
│   └── services/       ドメインとDBを繋ぐアプリケーションサービス
├── db/               Drizzle スキーマ・マイグレーション・シード
├── app/              Next.js App Router（画面とServer Actions）
├── components/       UIプリミティブとチャート
└── lib/              表示フォーマッタ・期間計算
```

技術構成: Next.js 16 (App Router) / TypeScript strict / Tailwind CSS 4 / Drizzle ORM + PostgreSQL /
Zod / Recharts / vitest。

認証はセッションCookie + scrypt によるパスワードハッシュを自前実装しています
（Supabase Auth を使う場合も `src/server/session.ts` の差し替えのみで済む構成です）。

---

## 設計上の重要な決定

### 1. Candidate を中心にすべてが繋がる

匿名診断の開始時点で内部 Candidate ID を発行し、氏名も電話番号もないまま追跡を始めます。
連絡先登録後も同じ ID を使い続けるため、匿名診断と登録後データが別人になりません。

```
Candidate
├── Acquisition   Sales User / Location / Shift / QR Code / Scan Event
├── Diagnosis     回答 / スキル / 資格 / 市場年収 / Match Score / 職種候補
├── Conversion    Lead Registration / Interview Booking / Interview Completed
├── Agent Routing Recommendations / Consent / Referral / Agent Status
└── Outcome       Application / Offer / Offer Salary / Joined / Revenue
```

### 2. 年収診断はブラックボックスにしない

AI予測ではなく、**市場年収マスター + キャリア遷移マスター + 説明可能な重み付け**で算出します。

Match Score（0〜100）の内訳はすべて保存され、画面に出せます。

| 要素 | 既定の重み |
| --- | --- |
| Skill Match | 35 |
| Certification Match | 20 |
| Experience Match | 15 |
| Location Match | 10 |
| Working Condition Match | 10 |
| Education / Management | 10 |

重みもランク閾値も**コードにハードコードせず** `app_settings` に保存し、
`/admin/diagnosis-settings` から変更できます。診断結果には使用した設定のスナップショットを保存するため、
チューニング後も過去の結果を再現できます。

「年収アップ確率72%」のような根拠のない精密さは出さず、**S / A / B / C** のランク表示にしています。
年収レンジも10万円単位に丸めます（例: 511万〜578万 ではなく 510〜580万円）。

### 3. QR は Sales Rep × Location × Shift を特定する

シフト開始時に固有QRを発行し、`/d/{token}` へのアクセスで attribution を確定します。
原則 **first valid attribution** で、同じ候補者が別の営業担当のQRを読んでも獲得者は移動しません
（DB上も `candidate_attributions` が候補者1行のPKで担保）。Admin は理由付きで修正できます。

### 4. 個人情報は価値提供の後

診断開始時点では個人情報を一切求めず、診断結果まで匿名で表示します。
エージェントへの提供は候補者が送客先を選び、明示的に同意した後だけで、同意文面・日時・提供先を保存します。
同意前のエージェント画面にPIIは表示されません。

### 5. ファネルはイベントログから再構築する

集計は `candidate_events` から行うため、後からファネル定義を変えても過去データを再集計できます。
現在のカラム構造に依存しません。

### 6. 分析はコホートで見る

期間フィルタは「その期間に実施したシフト」を選び、そのシフトが獲得した候補者の
**その後の成果すべて**を紐づけます。これにより Revenue / Sales Hour と
Gross Profit / Sales Hour が意味のある数字になります。
トップダッシュボードでは、これに加えて期間内イベントベースのファネルも併記します。

単純なQR獲得数ではなく **Gross Profit per Sales Hour** を最重要指標として扱い、
サンプルサイズが小さいセグメントには低信頼フラグを表示します（n=7 の場所が n=500 より上位に見えないように）。

---

## テスト

```bash
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm test            # vitest（ユニット + 統合）
npm run build       # 本番ビルド
```

`DATABASE_URL` が設定されている場合、`test/pipeline.integration.test.ts` が実PostgreSQLに対して
以下を検証します（未設定なら自動スキップ）。

- 2人の営業担当のQRを続けて読んでも attribution は最初の1人に固定される
- スキャンイベントは2件記録されるが attribution は1行のまま
- 同一イベントでインセンティブが二重計上されない
- 診断結果が同じ Candidate ID に紐づく
- ファネルがイベントログのみから再構築できる

ユニットテストは診断エンジン（スキル/資格/経験マッチ、年収レンジ、ランク判定）、
インセンティブエンジン（金額、重複防止、有効期間、条件）、attribution、ファネル集計、
RBAC（他営業のシフト変更不可・他エージェントの候補者閲覧不可）を対象にしています。

---

## MVPで実装していないもの

保険・金融商品、資産運用、高度な機械学習、AIによる年収予測、求人クローリング、MA、SMS送信、
複雑なCRM、請求・支払システム、エージェントとの契約管理。
いずれも将来追加できるよう、データソースを抽象化した設計にしています。

利用規約・プライバシーポリシー本文は `/privacy` にプレースホルダーを置いています。

---

## 過去の設計ドキュメント

`docs/` 配下には、本リポジトリで先行して検討していた採用代行（RPO）エージェント構想の設計メモが残っています。
本MVPとは別テーマのため、実装には含まれていません。
