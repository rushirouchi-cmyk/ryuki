# INFRALINK AI Talent Intelligence System

インフラリンク株式会社向け「人材紹介会社の AI Operating System」。

単なる候補者管理システム (ATS) ではなく、**候補者登録 → AI 解析 → 求人提案 → CA 対応 → AI 進捗監視 → 放置検知 → WEB 市場調査 → 未取引企業の発見 → 新規開拓提案 → 選考結果の蓄積 → 学習** という循環を回すための意思決定基盤です。

PORTERS を **Source of Truth** とし、その上に AI による判断・監視・分析・提案の層を載せます。PORTERS を置き換えるものではありません。

---

## 30 秒で動かす

外部 API キーは不要です。未接続時は Mock Adapter が動作します。

```bash
cd infralink
cp .env.example .env          # AUTH_SECRET を任意のランダム文字列に変更
npm install
npm run db:reset              # SQLite 作成 + デモデータ投入 + 全 Agent 実行
npm run dev                   # http://localhost:3000
```

### デモ用ログイン

初期パスワードは全ユーザー共通で `infralink2026`（`SEED_PASSWORD` で変更可）。

| メールアドレス | 権限 | 最初に開く画面 |
| --- | --- | --- |
| `admin@infralink.example.co.jp` | admin | Executive Dashboard |
| `exec@infralink.example.co.jp` | executive | Executive Dashboard |
| `suzuki@infralink.example.co.jp` | CA | 今日やること |
| `tanaka@infralink.example.co.jp` | CA | 今日やること |
| `sato@infralink.example.co.jp` | CA | 今日やること |
| `yoshida@infralink.example.co.jp` | RA | 新規開拓 |
| `okada@infralink.example.co.jp` | RA | 新規開拓 |

> デモ用の認証情報です。本番環境では必ず変更してください（[SECURITY.md](docs/SECURITY.md)）。

デモデータには設備保全 / 施工管理 / サービスエンジニア / 生産技術 / 建築設計 / 電気設備 / プラント / ファシリティ / データセンターの候補者 12 名、求人 22 件、企業 14 社（既存取引 8 社・未取引 6 社）、選考 12 件が含まれます。

---

## 何ができるか

### 1. 候補者を放置しない (Agent 01: CA Supervisor)

フェーズごとに異なる SLA で監視します。「3 日更新がない」という一律判定はしません。

| フェーズ | 確認すること | 既定 SLA |
| --- | --- | --- |
| 初回面談前 | 面談日時が設定済みか | 24 時間 |
| 面談済み | 求人を提案したか | 24 時間 |
| 求人提案済み | 意向を確認したか | 48 時間 |
| 応募意思あり | 企業へ推薦したか | 翌営業日 |
| 書類選考中 | 企業回答を確認したか | 7 日 |
| 面接予定 | 面接対策を実施したか | 面接 48 時間前 |
| 面接後 | 候補者所感を回収したか | 24 時間 |
| 内定 | 条件確認・フォロー・他社状況 | 24 時間（最重要） |
| 保留 | 次回接触予定日を超えていないか | 予定日 |

期限を超えると **経営者へ直接通知せず、まず担当 CA へ AI が状況確認**します。回答がなければ再通知し、それでも回答がなければ経営層へエスカレーションします（時間は管理画面から変更可）。

CA の回答は選択肢でも自由記述でも受け付け、`status` / `last_contact_date` / `next_action` / `next_action_date` / `memo` へ構造化します。

### 2. 求人マッチング (Agent 02: Matching)

職務経歴からスキル・資格を構造化し、100 点満点でスコアリングします。**必ず判断根拠を表示**します。

```
95/100  西日本重工業株式会社 / 設備保全エンジニア（大阪工場）
  経験職種    +25/25  経験職種「設備保全」が求人職種と一致
  必須スキル  +20/20  必須 3 件中 3 件一致 (設備保全・PLC・予防保全)
  資格        +10/10  必要資格 1 件中 1 件保有 (電験三種)
  勤務地      +10/10  希望勤務地と一致
  ...
  懸念: なし
  Confidence: Medium （不足情報: 転勤可否が不明）
```

情報が足りない項目は**推測で加点せず「不足情報」として明示**し、Confidence を下げます。

### 3. 候補者起点の企業発見 (Agent 03: Market Research)

保有求人に合う求人が無くても、候補者の経歴から「採用可能性のある企業」を WEB 上に探します（Candidate Driven Business Development）。

検索には**匿名化プロフィールしか渡しません**。氏名・メール・電話・詳細住所は送信前に検証で弾きます。

```
34歳 / 大阪府 / 化学メーカー / 設備保全8年 / PLC / 電験三種
   ↓
検索クエリ: 設備保全 PLC シーケンス制御 故障対応 第一種電気工事士 電験三種 化学メーカー 大阪府
   ↓
発見企業のうち、自社 DB に無い企業 = 未取引 (transaction_status='unknown')
```

### 4. 新規開拓の優先順位付け (Agent 04: Business Development)

**1 候補者だけで判断しません。** 保有候補者プール全体との相性を見ます。

```
93/100  北関東マテリアル株式会社（未取引）
  候補者適合度 +30/30 / 現在の採用需要 +25/25 / 保有候補者との相性 +11/15 ...
  理由: 最上位候補者との Match は 100。加えて当社保有のサービスエンジニア人材 6名
        (Sランク 2名 / Aランク 4名) との親和性が高く、単発求人ではなく
        継続的な採用支援先になる可能性がある。
  切り口: 公開中の「サービスエンジニア（埼玉県）」に対し、即戦力人材の紹介提案から入る
  営業文面案: （個人特定情報を含まない匿名の概要のみ）
```

---

## ドキュメント

| ドキュメント | 内容 |
| --- | --- |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | システム全体構成・データフロー・画面一覧・API 設計・フォルダ構成 |
| [DATABASE.md](docs/DATABASE.md) | ER 図・全テーブル定義・列挙値 |
| [AI_AGENTS.md](docs/AI_AGENTS.md) | 各 Agent の Trigger / Input / Logic / Output |
| [PORTERS_INTEGRATION.md](docs/PORTERS_INTEGRATION.md) | PORTERS Adapter の設計と接続手順 |
| [GOOGLE_SHEETS_INTEGRATION.md](docs/GOOGLE_SHEETS_INTEGRATION.md) | Google Sheets 連携（MVP のデータソース） |
| [SECURITY.md](docs/SECURITY.md) | 個人情報保護・認証・権限・監査 |
| [DECISIONS.md](docs/DECISIONS.md) | 仕様が不足していた箇所の判断記録 (ADR) |

---

## コマンド

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバー起動 |
| `npm run build` / `npm start` | 本番ビルド / 起動 |
| `npm run typecheck` / `npm run lint` | 型チェック / Lint |
| `npm run db:reset` | ローカル SQLite を作り直してデモデータ投入 |
| `npm run seed` | デモデータ投入（既存データは upsert） |
| `npm run sheets:sync` | データソースから取り込み |
| `npm run sheets:template` | Google Sheets 用 CSV テンプレートを生成 |
| `npm run agents:run <job>` | 定期ジョブを CLI 実行 |
| `npm run db:use-postgres` | Prisma の provider を PostgreSQL へ切替 |

### 定期ジョブ

`npm run agents:run monitor` のように CLI から、または `POST /api/cron/<job>`（`Authorization: Bearer $CRON_SECRET`）から実行します。

`sync` / `monitor` / `escalation` / `matching` / `market_research` / `bd_ranking` / `daily_report` / `weekly_bd_report`

実行時刻は管理画面（設定 → エスカレーションと定期実行）で管理し、スケジューラ側へ反映します。

---

## 外部サービスの接続

すべて未接続でも動作します（Mock へ自動フォールバックし、管理画面の「接続状態」に表示されます）。

| 種別 | 環境変数 | 選択肢 |
| --- | --- | --- |
| データソース | `DATA_SOURCE` | `mock` / `sheets` / `porters` |
| LLM | `AI_PROVIDER` | `mock` / `anthropic` / `openai` / `gemini` |
| WEB 検索 | `SEARCH_PROVIDER` | `mock` / `brave` / `serper` / `tavily` |
| 通知 | `NOTIFICATION_PROVIDER` | `console` / `smtp` / `slack` |

API キーはコードに書かず `.env` で管理します。テンプレートは [.env.example](.env.example)。

---

## 実装状況

**Phase 1 (MVP) — 実装済み**

ユーザー管理 / 候補者管理 / 求人管理 / 活動履歴 / Next Action / 期限管理 / CA Dashboard / Executive Dashboard / AI アラート / CA 状況確認 / メール通知 / Google Sheets 連携 / AI 候補者構造化 / ルールベース求人マッチ / Mock データ

**Phase 2 — 実装済み（PORTERS API のみ接続待ち）**

WEB 求人検索 / 未取引企業探索 / Business Development Score / RA 向け新規開拓画面 / 定期 Market Research / 企業単位の候補者群マッチ。PORTERS Adapter は実装済みで、テナントの API 仕様確定後に正規化関数を合わせるだけで接続できます。

**Phase 3 — 基盤のみ**

過去実績の蓄積・集計（職種別/業界別/年齢別/資格別/経験年数別/企業別の通過率、キャリアチェンジ成功パターン、見送り理由タグ）とスカウト実績テーブルは実装済みです。これらを Match Score へ反映する学習ロジックは、実データが一定量たまってからの着手としています（[DECISIONS.md](docs/DECISIONS.md) ADR-005）。
