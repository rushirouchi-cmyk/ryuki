# PORTERS 連携

## 1. 位置づけ

**PORTERS は Source of Truth である。** 本システムは PORTERS を置き換えない。

| PORTERS が持つもの | 本システムが持つもの |
| --- | --- |
| 候補者・求人・企業・選考の基幹データ | AI 用に構造化したスキル・資格 |
| 活動履歴 | AI 判断結果とその根拠 |
| | マッチングスコアと内訳 |
| | WEB 企業調査結果 |
| | 新規開拓候補と優先度 |
| | アラートとエスカレーション状態 |
| | 学習用の集計データ |

同期は **取り込み方向のみ**。本システムから PORTERS を書き換えない。CA が本システムで記録した対応は PORTERS にも入力する運用を前提とする（将来的な書き戻しは §5 参照）。

## 2. Adapter 設計

データ取得とアプリケーションロジックを密結合させないため、`TalentDataSource` インターフェースを挟む。

```typescript
interface TalentDataSource {
  readonly name: string;
  healthCheck(): Promise<{ ok: boolean; detail: string }>;
  fetchCompanies(): Promise<ExternalCompany[]>;
  fetchJobs(): Promise<ExternalJob[]>;
  fetchCandidates(): Promise<ExternalCandidate[]>;
  fetchApplications(): Promise<ExternalApplication[]>;
  fetchActions(): Promise<ExternalAction[]>;
}
```

実装は 3 つ。切り替えは環境変数 `DATA_SOURCE` のみ。

| 値 | 実装 | 用途 |
| --- | --- | --- |
| `mock` | `MockDataSource` | 未接続時・デモ（既定） |
| `sheets` | `GoogleSheetsDataSource` | MVP 期間 |
| `porters` | `PortersDataSource` | 本番 |

アプリケーション側は DTO（`ExternalCandidate` など）しか知らないため、データ元が変わってもロジックの変更は不要である。

## 3. 接続手順

### 3.1 環境変数

```bash
DATA_SOURCE="porters"
PORTERS_API_BASE_URL="https://<tenant>.porters.jp/api/v1"
PORTERS_API_KEY="..."
PORTERS_TENANT_ID="..."
```

キーはコードに書かず `.env` で管理する。

### 3.2 項目マッピングの調整

PORTERS はテナントごとにカスタム項目名が異なる。そのため `src/lib/adapters/datasource/porters.ts` を「HTTP 取得」と「DTO への正規化」に分けてある。**接続時に触るのは正規化関数だけ**である。

```typescript
function mapCandidate(r: Record<string, unknown>): ExternalCandidate {
  return {
    externalId: String(r.id ?? r.candidate_id),
    name: String(r.name ?? ''),
    age: int(r.age),
    location: str(r.address ?? r.location),
    ownerCaEmail: str(r.owner_email ?? r.owner_ca_email),
    careerText: str(r.career_summary ?? r.resume_text),
    // ↑ テナントのカスタム項目名に合わせてここを変更する
    ...
  };
}
```

対象は `mapCompany` / `mapJob` / `mapCandidate` / `mapApplication` / `mapAction` の 5 つ。

### 3.3 想定エンドポイント

現在の実装が前提としているパスは以下。テナントの API 仕様に合わせて `fetchXxx()` のパスを変更する。

| メソッド | パス | 用途 |
| --- | --- | --- |
| GET | `/health` | 疎通確認 |
| GET | `/companies?page=&per_page=` | 企業 |
| GET | `/jobs?page=&per_page=` | 求人 |
| GET | `/candidates?page=&per_page=` | 候補者 |
| GET | `/selections?page=&per_page=` | 選考 |
| GET | `/activities?page=&per_page=` | 活動履歴 |

ページングは `{ items: [...], hasNext: boolean }` を想定し、`fetchAll()` が吸収する（暴走防止のため 100 ページで打ち切り）。

認証は `Authorization: Bearer <PORTERS_API_KEY>` と `x-tenant-id` ヘッダ。異なる方式（OAuth 等）の場合は `request()` を変更する。

### 3.4 疎通確認

```bash
DATA_SOURCE=porters npm run sheets:sync
```

または管理画面（設定 → 接続状態）で確認する。接続できない場合は自動的に Mock へフォールバックし、その旨が画面と同期結果の警告に表示される。**接続情報が無くても開発は止まらない。**

## 4. 同期の挙動

```
fetchCompanies → companies.external_id で upsert
fetchJobs      → jobs.porters_job_id で upsert（企業が未取得ならスキップして警告）
fetchCandidates→ candidates.porters_id で upsert
                 経歴は毎回作り直し（基幹側が正）
                 スキル・資格は source='human' で登録（AI 抽出より優先）
fetchApplications → applications.external_id で upsert
fetchActions   → candidate_actions.external_id で upsert
```

突合キーは常に外部 ID である。**氏名をキーにしない。**

`担当CA` は `owner_ca_email` を本システムの `users.email` と突合する。一致するユーザーがいない場合はスキップして警告を出す（候補者自体は取り込む）。

見送り理由の原文（`rejection_reason_original`）は同期で更新するが、AI が提案したタグと人が確定したタグは同期で触らない。

## 5. 将来の拡張

### 5.1 書き戻し

CA が本システムで記録した対応を PORTERS へ書き戻す場合、`TalentDataSource` に `pushAction()` 等を追加する。ただし以下を前提とする。

- 書き戻しは**人が確定した情報のみ**。AI が推定した値を基幹へ書かない。
- 書き戻し前に `audit_logs` へ記録する。
- 競合時は PORTERS 側を優先する（Source of Truth のため）。

### 5.2 差分同期

現在は全件取得。件数が増えた場合は `updated_since` パラメータによる差分同期へ変更する。`fetchAll()` にクエリを追加するだけで対応できる。

### 5.3 Webhook

PORTERS 側の更新を即時反映したい場合は Route Handler を追加し、受信後に該当候補者だけ再同期・再マッチングする。
