# ryuki-mcp: MCP サーバーツール仕様

自作 MCP サーバー `ryuki-mcp` が提供するツールの一覧と入出力仕様。既存 MCP (Gmail / GCal / Drive / tldv / GitHub) が担うものは含めない。

## 命名規約

- ツール名は `snake_case`、動詞から始める (`get_`, `search_`, `create_`, `update_`, `send_`)。
- 読み取り系と書き込み系を明確に分ける。書き込み系は必ず `dry_run` パラメータを持ち、デフォルトは `dry_run=false` にしない (false にするのは承認済みの呼び出しだけ)。
- 外向き I/O (`send_*`, `publish_*`) は `idempotency_key` 必須。

## ツール一覧

### JD / スカウトテンプレート

| ツール | 種別 | 概要 |
| --- | --- | --- |
| `jd_templates_search` | read | 職種・キーワードで既存 JD を検索。要点だけ返す (フルテキストは `get` で個別取得)。 |
| `jd_template_get` | read | JD 全文の取得。 |
| `jd_template_save` | write | 生成した JD を保存。バージョン管理あり。 |
| `scout_templates_search` | read | 媒体別に既存スカウト文テンプレを検索。 |
| `scout_template_save` | write | 成果の出たスカウト文を再利用可能な形で保存。 |

### 求人 (Job)

| ツール | 種別 | 概要 |
| --- | --- | --- |
| `job_list` | read | オープン中の求人一覧。ATS が Source of Truth。 |
| `job_get` | read | 求人 1 件の詳細。 |
| `job_publish` | write | JD を ATS に公開。`dry_run=true` で差分プレビュー。 |
| `job_close` | write | 求人を締める。 |

### 候補者 (Candidate)

| ツール | 種別 | 概要 |
| --- | --- | --- |
| `candidate_search` | read | 媒体横断検索 (v2)。ID とマスク済み属性のみ返す。 |
| `candidate_profile_get` | read | 候補者属性 (経験・スキル・志向)。氏名・連絡先は返さない。 |
| `candidate_notes_get` | read | 選考メモ・面接評価の取得。 |
| `candidate_notes_append` | write | 選考メモの追記。 |

### 選考 (Application)

| ツール | 種別 | 概要 |
| --- | --- | --- |
| `application_list` | read | 求人 × ステージでの応募一覧。 |
| `application_get` | read | 応募 1 件の詳細 (ステータス履歴付き)。 |
| `application_update_stage` | write | 選考ステージを進める / 差し戻す。要承認。 |

### アウトバウンド

| ツール | 種別 | 概要 |
| --- | --- | --- |
| `scout_send` | write | スカウト送信。氏名プレースホルダはツール内で解決。要 `idempotency_key`。 |
| `scout_status` | read | 送信済みスカウトの開封・返信状況。 |

### パイプライン集計

| ツール | 種別 | 概要 |
| --- | --- | --- |
| `pipeline_snapshot` | read | 現時点のステージ別候補者数。 |
| `pipeline_metrics` | read | 期間指定 KPI (応募数、通過率、TAT、チャネル別 CPA)。 |
| `pipeline_alerts` | read | 目標値との乖離アラート一覧。 |

### 監査

| ツール | 種別 | 概要 |
| --- | --- | --- |
| `audit_log_append` | write | 外部 I/O ツールが内部で呼ぶ。ユーザーからは直接使わない。 |
| `audit_log_query` | read | 監査ログの検索 (誰が何をいつ)。 |

## 入出力仕様の例

### `jd_templates_search`

```jsonc
// 入力
{
  "role": "Sales Manager",           // 必須。職種名
  "keywords": ["SaaS", "エンプラ"],   // 任意
  "limit": 5                          // 任意 (デフォルト 5)
}

// 出力
{
  "results": [
    {
      "id": "jd_2024_11_sales_mgr_v3",
      "role": "Sales Manager (Enterprise SaaS)",
      "summary": "エンタープライズ SaaS の新規開拓を率いる Sales Manager。年収 1000-1400 万。",
      "key_phrases": ["MRR", "$1M+ deal", "リーダー経験 3 年以上"],
      "updated_at": "2024-11-08"
    }
  ]
}
```

### `scout_send`

```jsonc
// 入力
{
  "channel": "bizreach",
  "candidate_id": "C-456",
  "job_id": "J-123",
  "subject": "{{candidate_name}} 様、Sales Manager ポジションのご案内",
  "body": "{{candidate_name}} 様\n\nはじめまして、...",
  "idempotency_key": "scout-C456-J123-20260714",
  "dry_run": false
}

// 出力
{
  "sent": true,
  "external_id": "bizreach:msg_xyz",
  "sent_at": "2026-07-14T10:30:00+09:00",
  "audit_log_id": "audit_98765"
}
```

### `pipeline_metrics`

```jsonc
// 入力
{
  "period": "last_7d",              // "last_7d" | "last_30d" | {from,to}
  "job_ids": ["J-123", "J-124"],    // 任意 (未指定なら全件)
  "group_by": "channel"             // "channel" | "job" | "stage"
}

// 出力
{
  "period": {"from": "2026-07-07", "to": "2026-07-13"},
  "totals": {
    "applications": 42,
    "pass_rate_1st_screen": 0.38,
    "avg_tat_days": 12.4
  },
  "breakdown": [
    {"key": "wantedly",  "applications": 18, "pass_rate": 0.44, "avg_tat_days": 10.1},
    {"key": "bizreach",  "applications": 15, "pass_rate": 0.33, "avg_tat_days": 14.2},
    {"key": "referral",  "applications":  9, "pass_rate": 0.55, "avg_tat_days": 11.0}
  ],
  "prev_period_comparison": {
    "applications_delta_pct": 0.18
  }
}
```

## 実装スタック案

- **言語**: Python 3.12
- **フレームワーク**: `mcp` 公式 SDK
- **ATS 抽象化**: `providers/` 配下に `greenhouse.py`, `lever.py`, `herp.py` を置き、共通 interface を `providers/base.py` で定義。
- **キャッシュ / ローカルストア**: SQLite (`data/ryuki.db`)。テンプレートと監査ログを保存。
- **設定**: `pydantic-settings` で環境変数を型付き読み込み。

## エラーハンドリング方針

- 外部 API の 4xx は `ToolError` としてそのままエージェントに返す (LLM に再考の余地を与える)。
- 5xx / タイムアウトは指数バックオフでリトライ (最大 3 回)。
- 認証エラー (401 / 403) はリトライせず即失敗、監査ログに `auth_error` として記録。
