# Career Routing Engine

街頭営業で獲得した転職潜在層を、**匿名の年収診断 → キャリア面談 → 転職エージェント送客 → 成果・売上**まで
一気通貫で追跡・分析するためのWebシステム（MVP）。

単なる年収診断サイトではなく、内部的なプロダクトコンセプトは次の2つです。

1. **Career Routing Engine** — 候補者の経験・スキル・資格から、現職だけでなく転用可能な職種まで探索し、
   年収改善余地を診断して、最適な転職支援先へルーティングする。
2. **街頭営業の定量化** — 「誰が・どこで・いつ獲得した候補者が、最終的にいくらの粗利になったか」を
   1営業時間あたりの粗利（Gross Profit / Sales Hour）まで遡って計測する。

---

## 1. すぐに動かす

PostgreSQLサーバーの用意は不要です（既定では組み込みのPGliteを使用します）。

```bash
cp .env.example .env
npm install
npm run setup     # マイグレーション + シードデータ投入（初回は1〜2分）
npm run dev       # http://localhost:3000
```

`npm run setup` は、6職種以上のマスタ・市場年収ベンチマーク・営業拠点・営業担当・エージェント3社に加え、
**約14週間分の街頭営業（98シフト / 候補者350名）を実際のドメインサービス経由でシミュレーション**します。
そのため初期状態から管理画面のファネル・エリア分析・収支が意味のある数字で表示されます。

### テスト用アカウント

パスワードはすべて `password123`（`.env` の `SEED_PASSWORD` で変更可能）。

| 役割 | メールアドレス | 入口 |
| --- | --- | --- |
| 管理者 | `admin@example.com` | `/admin` |
| 営業 | `sales1@example.com` 〜 `sales4@example.com` | `/sales` |
| エージェント | `agent1@example.com`（テクノキャリア・パートナーズ） | `/agent` |
| エージェント | `agent2@example.com`（関西モノづくり転職センター） | `/agent` |
| エージェント | `agent3@example.com`（ビルドキャリア） | `/agent` |

候補者側の年収診断は**ログイン不要**です。

### 候補者フローの試し方

営業QRのURLは `/d/{token}` です。トークンは営業画面から確認できます。

1. `sales1@example.com` でログイン →「営業開始」→ 場所を選んでシフト作成
2. 発行されたQRコード下のURL（`http://localhost:3000/d/xxxx`）を開く
3. 匿名診断 → 結果表示 → 連絡先登録 → 面談予約 → エージェント選択 → 同意 → 送客

シード済みのQRを使う場合は、管理画面「候補者」から既存候補者を確認できます。

---

## 2. 主要画面

### 候補者（モバイルファースト・認証不要）

| URL | 内容 |
| --- | --- |
| `/d/[qrToken]` | QR着地。営業担当×場所×シフトを紐づけ、候補者IDを発行して診断LPへ |
| `/diagnosis/[token]` | 診断LP（90秒・匿名・無料） |
| `/diagnosis/[token]/questions` | 全16問の診断（1画面1問・進捗バー付き） |
| `/diagnosis/[token]/result` | 想定年収レンジ / 改善余地 / 市場価値ランク / 推奨職種 |
| `/diagnosis/[token]/register` | 連絡先登録（**希望者のみ**） |
| `/diagnosis/[token]/booking` | キャリア面談予約 |
| `/diagnosis/[token]/agents` | おすすめエージェント選択 + 第三者提供同意 |
| `/diagnosis/[token]/done` | 送客完了 |

### 営業（モバイルファースト）

| URL | 内容 |
| --- | --- |
| `/sales` | 本日の実績・暫定報酬・今月累計 |
| `/sales/shift/new` | 営業開始（場所・時間・天候）→ 専用QR発行 |
| `/sales/shift/[id]` | 声掛け／立ち止まりカウンター（取消つき）・QR・シフト成果 |
| `/sales/incentives` | 報酬明細（承認状態つき） |

### 管理者（PC中心・レスポンシブ）

| URL | 内容 |
| --- | --- |
| `/admin` | 獲得・ファネル・転換率・収支サマリー（今日/今週/今月/直近30日/全期間） |
| `/admin/funnel` | ファネル詳細と営業場所別の転換率比較 |
| `/admin/areas` | エリア比較（エリアスコア・粗利/h）＋7次元の絞り込み |
| `/admin/timebands` | 曜日別・時間帯別・**営業場所×曜日×時間帯**の比較 |
| `/admin/sales` | 営業担当別のKPIと粗利/h |
| `/admin/agents` | エージェント別の決定率・平均提示年収・売上、職種別パフォーマンス |
| `/admin/candidates` | 候補者一覧 / `[id]` で獲得〜診断〜同意〜送客〜売上まで1画面 |
| `/admin/diagnosis-settings` | 診断エンジンの重み・しきい値・市場年収マスタ |
| `/admin/incentive-settings` | 報酬ルール、インセンティブ承認、売上確定 |

### エージェント

| URL | 内容 |
| --- | --- |
| `/agent` | 自社への紹介サマリーと未対応リスト |
| `/agent/candidates` | 自社に送客された候補者のみ |
| `/agent/candidates/[id]` | 候補者カード・進捗更新・内定/入社の登録 |

---

## 3. 設計の要点

### 3.1 Candidateを中心にすべてが繋がる

匿名診断の開始時点で内部Candidate IDを発行し、個人情報登録後も**同じIDを使い続けます**。
1人の候補者について、獲得 → 診断 → 転換 → 送客 → 成果 → 売上まで途切れずに辿れます。

```
Candidate
├── Acquisition   sales_user / location / shift / qr_code / scan_event
├── Diagnosis     answers / skills / certifications / occupation matches / salary range
├── Conversion    candidate_contacts / interview_bookings
├── Agent Routing agent_recommendations / consents / referrals
└── Outcome       offer_salary / joined_date / revenue_events
```

### 3.2 ファネルはイベントログから集計する

すべての節目は `candidate_events` に追記されます。管理画面の集計は**このログだけから導出**しており、
現在のカラム構成に依存していません。ファネルの定義を後から変えても、マイグレーションは不要です。

各ステップは**ユニーク候補者数**で数えます（1人が2社に送客されても送客数は1人）。

### 3.3 年収診断はブラックボックスにしない

AI予測ではなく、**説明可能なルールベース + 市場年収マスタ + キャリア遷移マスタ**で算出します。

- `career_transition_rules` で現職から近接職種を探索
- 各職種との適合度を 0〜100 で採点（Skill 35 / Certification 20 / Experience 15 /
  Location 10 / Working Condition 10 / Education・Management 10）
- 適合度が一定以上の職種だけを候補に残し、地域別 `salary_market_benchmarks` と掛け合わせて
  保守的な年収レンジを算出
- 表示は**10万円単位に丸め**、「511万〜578万円」のような過度な精密さは出しません
- 確率は表示せず、**S / A / B / C** のランクのみ

重みもしきい値も丸め単位もコードには埋め込まず、`app_settings` に保存して管理画面から変更できます。
算出根拠（職種ごとのスコア内訳）は `diagnosis_occupation_matches` に保存され、管理画面で確認できます。

**過大表示の抑制**: `maxUpliftFactor`（既定1.8倍）でレンジ上限を現年収の倍率で制限します。
ただし対象職種の市場下限そのものが上限を超える場合は、市場より低い数字を作らないため制限を適用しません。

### 3.4 QRアトリビューションは first valid attribution

QRトークンは `sales_user × location × shift` を指し、個人情報は一切含みません。
最初にスキャンしたQRで紐づけが確定し、**別の営業担当のQRを読み直しても紐づけは移りません**。
診断開始時点で `attribution_locked_at` を打刻します。管理者は理由を添えて修正でき、監査ログに残ります。

### 3.5 インセンティブの二重計上はDBで防ぐ

`incentive_ledger` に `(candidate_id, event_type)` のユニーク制約があり、
同じ候補者の同じ成果は**構造的に二度計上できません**（読んでから書く判定ではありません）。
金額・条件・適用期間は `incentive_rules` で管理し、管理画面から追加・変更できます。

**QR読取そのものには報酬を設定しません**。質の低いQR獲得競争を防ぐためです。

### 3.6 個人情報とエージェントへの提供

- 診断開始時点では個人情報を一切求めません（匿名で結果まで表示）
- 個人情報は `candidate_contacts` に分離して保持
- エージェントへの提供は、候補者が**自分で選択し、明示的に同意した先だけ**
- 同意日時・提供先・同意文面・文面バージョンを `consents` に保存
- `referrals.consent_id` は NOT NULL の外部キー。**同意なしに送客レコードは作れません**
- エージェント画面は、同意が存在し、かつ撤回されていない場合にのみ連絡先を表示します
- 監査ログに氏名・メール・電話番号は書き出しません（`redactPii`）

---

## 4. 技術構成

| 領域 | 採用 |
| --- | --- |
| フレームワーク | Next.js 16（App Router）/ React 19 / TypeScript strict |
| スタイル | Tailwind CSS v4（UIプリミティブは自前実装） |
| ORM | Drizzle ORM（PostgreSQL方言） |
| DB | 既定：組み込みPGlite / 本番：PostgreSQL・Supabase |
| バリデーション | Zod |
| グラフ | Recharts |
| テスト | Vitest（PGlite上での統合テストを含む） |

### データベースの切り替え

`DATABASE_URL` を設定すると `postgres-js` ドライバに切り替わります。未設定なら `./data/pglite` を使用します。
スキーマ・マイグレーション・クエリは同一です。

```bash
# ローカルPostgreSQL
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ryuki

# Supabase
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
```

### 認証について

MVPではDBに保存したセッション（scrypt + HttpOnly Cookie）で認証しています。
`src/lib/auth/` に隔離してあるため、Supabase Auth や外部IdPへの差し替えはこのディレクトリの
変更だけで完結します。候補者の匿名診断は認証不要、候補者ページのURLは推測不能なトークンです。

---

## 5. コマンド

```bash
npm run dev          # 開発サーバー
npm run build        # 本番ビルド
npm run start        # 本番サーバー

npm run db:generate  # スキーマからマイグレーションSQLを生成
npm run db:migrate   # マイグレーション適用
npm run db:seed      # シード投入（既存データは truncate されます）
npm run db:reset     # データベースを削除
npm run setup        # migrate + seed

npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run test         # Vitest
npm run verify       # lint + typecheck + test + build
```

---

## 6. テスト

`npm run test` で98件のテストが実行されます。

| ファイル | 対象 |
| --- | --- |
| `tests/diagnosis-engine.test.ts` | Skill / Certification / Experience マッチ、ベンチマーク選択、年収レンジ算出、ランク判定 |
| `tests/attribution.test.ts` | QR → 営業 → シフト → 場所、二重QR読み込み、first attribution、紐づけ確定 |
| `tests/incentive.test.ts` | ルール選択と適用期間、金額、二重計上防止、承認・却下、QRは対象外 |
| `tests/funnel.test.ts` | candidate_events からのファネル集計、シフト単位の成果、売上計上 |
| `tests/permissions.test.ts` | 営業／エージェントの権限分離、同意なしのPII非表示、同意撤回、パスワード検証 |
| `tests/agent-matching.test.ts` | エージェント推薦スコアと推薦理由 |
| `tests/area-score.test.ts` | エリアスコアの相対評価、サンプル不足の判定、ユニットエコノミクス |

統合テストは PGlite 上の**実際のPostgreSQL**に対して実行されるため、
本番と同じSQL（enum・ユニーク制約・`filter (where ...)`）を検証しています。

---

## 7. 計測できる事業仮説

本MVPは、以下の8つの仮説を数字で検証できることを設計目標にしています。

| # | 仮説 | 確認場所 |
| --- | --- | --- |
| 1 | 街頭でQRを読み取るか | `/admin/funnel` 立ち止まり率・QR読取率 |
| 2 | 診断を完了するか | 診断開始率・診断完了率 |
| 3 | 個人情報を登録するか | リード登録率 |
| 4 | 面談まで進むか | 面談予約率・面談着座率 |
| 5 | エージェントが価値を感じるか | `/admin/agents` 受諾率 |
| 6 | 面談着座・転職成果につながるか | 内定率・入社率・平均年収上昇 |
| 7 | 地域・曜日・時間・担当で差が出るか | `/admin/areas`・`/admin/timebands`・`/admin/sales` |
| 8 | 1営業時間あたりの粗利を黒字にできるか | 全画面の **粗利 / 営業時間** |

---

## 8. MVPの範囲外

保険・金融商品・資産運用、高度な機械学習、AIによるブラックボックス年収予測、
リアルタイム求人クローリング、MA・SMS配信、請求書・給与振込、エージェントとの契約管理は実装していません。
ただし、いずれも後から追加できるようDB設計を分離しています
（例：`salary_market_benchmarks` は `source` / `source_date` / `confidence_level` / `sample_size` を保持し、
公的統計・求人データ・自社転職実績を同じ形式で取り込めます）。

利用規約・プライバシーポリシー・第三者提供同意の文面はプレースホルダーです。
本番導入前に、個人情報保護方針に準拠した文面へ差し替えてください（`app_settings` の `consent.template`）。

---

## 9. 残課題

- **同意撤回のUI**: データモデル（`consents.revoked_at`）と表示制御は実装済みですが、
  候補者・管理者からの撤回操作画面は未実装です。
- **候補者の名寄せ**: 別端末から複数回スキャンすると別Candidateになります。
  リード登録時のメールアドレスによる名寄せは未実装です。
- **面談枠の実在管理**: 予約枠は固定ロジックで生成しています。実際の担当者カレンダー連携は未実装です。
- **LTV集計**: 30/60/90日LTVを算出できるデータ構造（イベントログ + 売上イベント）は揃っていますが、
  集計画面は未実装です。
- **エリアスコアの絶対評価**: 現在は同一期間内の相対評価（パーセンタイル）です。
  実績が蓄積したら絶対基準への移行を検討してください。
