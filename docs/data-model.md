# データモデル

ryuki-mcp が扱う中核エンティティ。ATS を Source of Truth としつつ、ryuki-mcp は下記スキーマでキャッシュとメタデータを保持する。

## エンティティ関係

```
Job ──────< Application >─── Candidate
              │
              ├───< Interview
              │
              └───< ScoutMessage
```

## Job (求人)

| フィールド | 型 | 備考 |
| --- | --- | --- |
| `id` | string (UUID) | ryuki-mcp 内 ID |
| `external_id` | string | ATS 側 ID (`greenhouse:1234` など) |
| `title` | string | ポジション名 |
| `department` | string | |
| `location` | string | |
| `employment_type` | enum | `full_time` \| `contract` \| `part_time` |
| `status` | enum | `draft` \| `open` \| `on_hold` \| `closed` |
| `salary_range` | `{min, max, currency}` | 任意 |
| `hiring_manager` | string | 社内メールアドレス |
| `jd_template_id` | string | 現行 JD への参照 |
| `created_at` / `updated_at` | timestamp | |

## Candidate (候補者)

**PII 分離設計**: 氏名・連絡先は別テーブル (`candidate_pii`) に格納し、LLM には触れさせない。

`candidate` テーブル (LLM 可視):

| フィールド | 型 | 備考 |
| --- | --- | --- |
| `id` | string | `C-XXXX` 形式 |
| `external_ids` | `{channel: id}` | 媒体側 ID の参照 |
| `years_of_experience` | int | |
| `current_role` | string | 職種のみ (会社名は含めない) |
| `skills` | `string[]` | タグ |
| `preferences` | object | 希望年収レンジ・勤務地・リモート可否 |
| `source_channel` | enum | `wantedly` \| `bizreach` \| `linkedin` \| `referral` \| `direct` |

`candidate_pii` テーブル (ツール内部でのみ利用):

| フィールド | 型 |
| --- | --- |
| `candidate_id` | FK |
| `name_encrypted` | bytes |
| `email_encrypted` | bytes |
| `phone_encrypted` | bytes |

暗号化キーはデプロイ環境の Secret Manager にのみ配置。

## Application (選考プロセス)

| フィールド | 型 | 備考 |
| --- | --- | --- |
| `id` | string | |
| `job_id` | FK | |
| `candidate_id` | FK | |
| `stage` | enum | `applied` \| `screening` \| `interview_1` \| `interview_2` \| `interview_final` \| `offer` \| `hired` \| `rejected` \| `withdrawn` |
| `stage_history` | `StageTransition[]` | 全遷移をタイムスタンプ付きで保持 |
| `applied_at` | timestamp | |
| `owner` | string | 社内担当者 |

`StageTransition`:

```jsonc
{
  "from": "screening",
  "to": "interview_1",
  "at": "2026-07-10T14:00:00+09:00",
  "by": "rushirouchi@gmail.com",
  "note": "書類通過"
}
```

## Interview (面接) — v2

| フィールド | 型 | 備考 |
| --- | --- | --- |
| `id` | string | |
| `application_id` | FK | |
| `round` | int | 1, 2, final |
| `scheduled_at` | timestamp | |
| `interviewers` | `string[]` | 社内メールアドレス |
| `calendar_event_id` | string | GCal イベント ID |
| `tldv_meeting_id` | string | tldv 側 ID (任意) |
| `feedback` | `InterviewFeedback[]` | 面接官別 |

## ScoutMessage (スカウトメッセージ)

| フィールド | 型 | 備考 |
| --- | --- | --- |
| `id` | string | |
| `channel` | enum | `wantedly` \| `bizreach` \| `linkedin` \| `email` |
| `candidate_id` | FK | |
| `job_id` | FK | |
| `subject_hash` | string | 本文の実体は保存しない、ハッシュのみ (PII 保護) |
| `body_hash` | string | |
| `sent_at` | timestamp | |
| `status` | enum | `queued` \| `sent` \| `opened` \| `replied` \| `bounced` |
| `idempotency_key` | string | UNIQUE |
| `audit_log_id` | FK | |

## AuditLog (監査ログ)

全ての外向き I/O と重要な状態変更を記録する。

| フィールド | 型 |
| --- | --- |
| `id` | string |
| `at` | timestamp |
| `actor` | string (承認したユーザーのメール) |
| `agent` | string (どのサブエージェントか) |
| `action` | enum (`scout_sent` / `job_published` / `stage_updated` / …) |
| `subject_type` / `subject_id` | 対象エンティティ |
| `dry_run` | bool |
| `payload_hash` | string |

## Template 系

### JDTemplate

| フィールド | 型 |
| --- | --- |
| `id` | string |
| `role` | string |
| `version` | int |
| `body_markdown` | text |
| `key_phrases` | `string[]` (検索用) |
| `used_for_job_ids` | `string[]` |
| `perf_metrics` | object (応募数・通過率など、任意) |

### ScoutTemplate

| フィールド | 型 |
| --- | --- |
| `id` | string |
| `channel` | enum |
| `persona_tags` | `string[]` |
| `subject` | string |
| `body` | string |
| `reply_rate` | float (任意) |

## PII / データ保護原則

1. **LLM に渡すエンティティは ID と非 PII 属性のみ**。実名・連絡先はツール側で解決する。
2. **監査ログは本文実体を保持しない**。ハッシュとメタデータで再現性を確保する。
3. **削除依頼への対応**: 候補者から削除依頼があれば `candidate_pii` を物理削除し、`candidate` は tombstone (`deleted_at`) を残す。監査ログは保持。
