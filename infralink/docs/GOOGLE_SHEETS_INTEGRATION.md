# Google Sheets 連携

## 1. 位置づけ

PORTERS API の接続がすぐに行えない場合に備えた、MVP 期間のデータソース。`TalentDataSource` の実装の 1 つであり、後から PORTERS へ切り替えてもアプリケーションロジックは変更しない。

## 2. シート構成

**1 枚の巨大なシートにしない。** 用途ごとにタブを分け、一意 ID で JOIN する。**氏名をキーにしない。**

| タブ名 | 役割 | 主キー | JOIN キー |
| --- | --- | --- | --- |
| `Candidates` | 候補者 | `candidate_id` | `owner_ca_email` → users |
| `CandidateActions` | 活動履歴 | `action_id` | `candidate_id`, `ca_email` |
| `Applications` | 選考 | `application_id` | `candidate_id`, `company_id`, `job_id` |
| `Jobs` | 求人 | `job_id` | `company_id` |
| `Companies` | 企業 | `company_id` | — |
| `Skills` | スキル・資格 | — | `candidate_id` |
| `BusinessDevelopment` | 新規開拓（システムが出力） | `opportunity_id` | `company_id` |
| `Alerts` | アラート（システムが出力） | `alert_id` | `candidate_id` |

## 3. テンプレートの生成

```bash
npm run sheets:template
```

`sheets-template/` に各タブの CSV が出力される（デモデータ入り）。これを Google スプレッドシートの同名タブへ読み込めば、そのまま取り込める形になる。

## 4. 列定義

### Candidates

| 列 | 必須 | 例 | 備考 |
| --- | --- | --- | --- |
| `candidate_id` | ● | `CAND001` | 一意。氏名を使わない |
| `name` | ● | `山田 太郎` | |
| `name_kana` | | `ヤマダ タロウ` | |
| `email` / `phone` | | | 直接識別情報。WEB 検索には渡らない |
| `age` | | `34` | |
| `location` | | `大阪府` | |
| `current_salary` / `desired_salary` | | `6200000` | 円。カンマ・「万円」表記も解釈する |
| `job_change_timing` | | `within_3m` | `immediate` / `within_3m` / `within_6m` / `passive` |
| `owner_ca_email` | ● | `suzuki@...` | `users.email` と突合 |
| `status` | | `active` | 既定 `active` |
| `phase` | | `offer` | 未知の値は `pre_interview` に丸める |
| `rank` | | `S` | `S` / `A` / `B` / `C` |
| `last_contact_date` | | `2026-09-01` | |
| `next_action` / `next_action_date` | | `内定条件の最終確認` / `2026-09-03` | **SLA 判定の要。必ず入れる** |
| `disclosure_consent` | | `TRUE` | `TRUE`/`はい`/`同意`/`1` を真と解釈 |
| `career_text` | | 職務経歴の自由記述 | AI 構造化の入力 |
| `desired_locations` 他 | | `大阪府,兵庫県` | カンマ・読点・`/`・`;`・`\|` 区切り |
| `transfer_allowed` 他 | | `negotiable` | `yes` / `no` / `negotiable` / 空欄=不明 |
| `priority_1..3` | | `年収` | 優先順位 |

### Skills

1 行 1 スキル。資格は `skill_category` に `qualification` を入れて同じシートで管理する。

| `candidate_id` | `skill_name` | `skill_category` | `skill_level` | `years_experience` | `evidence` |
| --- | --- | --- | --- | --- | --- |
| `CAND001` | `PLC` | `technical` | | | |
| `CAND001` | `電験三種` | `qualification` | | | |

`Candidates` シートに `skills` / `qualifications` 列を置いて記入することもできる（`Skills` シートに行があればそちらを優先）。

### Companies

| `company_id` | `company_name` | `transaction_status` | `industry` | `location` | `website` | `relationship_status` | `employee_count` |
| --- | --- | --- | --- | --- | --- | --- | --- |

`transaction_status`: `existing` 既存取引 / `prospect` 開拓中 / `unknown` 未取引

### Jobs

| `job_id` | `company_id` | `job_title` | `job_category` | `location` | `salary_min` | `salary_max` | `required_skills` | `preferred_skills` | `required_experience` | `qualifications` | `description` | `status` |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

スキル・資格はカンマ区切り。取り込み時にタクソノミで正規化される（`1級電気工事施工管理技士` → `電気工事施工管理技士`）。

### Applications

| `application_id` | `candidate_id` | `company_id` | `job_id` | `application_date` | `current_stage` | `document_result` | `interview_1_result` | `interview_2_result` | `final_result` | `offer_status` | `acceptance_status` | `offer_deadline` | `rejection_reason_original` |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

`rejection_reason_original` には**企業からの原文をそのまま**入れる。要約・編集しない。タグ付けは AI が提案し、人が画面で確定する。

### CandidateActions

| `action_id` | `candidate_id` | `ca_email` | `action_type` | `action_date` | `memo` | `next_action` | `next_action_date` |
| --- | --- | --- | --- | --- | --- | --- | --- |

`action_type` は SLA 判定の充足条件そのものなので、種別を正しく入れることが重要。

`call` / `mail` / `meeting` / `job_proposal` / `intent_check` / `recommend` / `interview_prep` / `interview_feedback` / `offer_follow` / `follow_up`

例: 「求人提案済み → 意向確認」の SLA は、`job_proposal` を起点に `intent_check` または `recommend` が記録されたかで解消を判定する。

## 5. 接続手順

### 5.1 サービスアカウントの作成

1. Google Cloud Console でプロジェクトを作成
2. **Google Sheets API** を有効化
3. サービスアカウントを作成し、JSON 鍵を発行
4. **対象スプレッドシートをサービスアカウントのメールアドレスに共有**（閲覧権限で可）

### 5.2 環境変数

```bash
DATA_SOURCE="sheets"
GOOGLE_SHEETS_SPREADSHEET_ID="1AbC..."          # URL の /d/ と /edit の間
GOOGLE_SERVICE_ACCOUNT_EMAIL="xxx@yyy.iam.gserviceaccount.com"
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMII...\n-----END PRIVATE KEY-----\n"
```

秘密鍵は改行を `\n` にエスケープして 1 行で記述する。**鍵ファイルをリポジトリに置かない。**

### 5.3 取り込み

```bash
npm run sheets:sync
```

管理画面（設定 → ジョブの手動実行 → データソース同期）からも実行できる。定期実行する場合は `POST /api/cron/sync`。

## 6. 実装

認証はサービスアカウントの JWT Bearer フロー（`jose` で署名 → `oauth2.googleapis.com/token` でアクセストークン取得）。追加の SDK には依存しない。

読み取りは各タブの 1 行目をヘッダーとして扱う。存在しないタブは空配列として扱うため、一部のタブだけ用意した状態でも動作する。

実装: `src/lib/adapters/datasource/sheets.ts`

## 7. PORTERS への移行

```bash
DATA_SOURCE=porters   # これだけ
```

シート側のデータは `external_id` で突合されているため、PORTERS 側の ID を同じ値に揃えておけば同一レコードとして更新される。ID 体系が異なる場合は、移行時に `candidates.porters_id` を更新するスクリプトを実行する。
