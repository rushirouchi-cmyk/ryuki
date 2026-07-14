# サブエージェント責務分担

Orchestrator 配下に置くサブエージェントの入力・出力・使用ツール・境界を定義する。

## 1. JD Author Agent (求人票作成)

### 責務
- 採用担当者からのヒアリング項目 (ポジション / 必須要件 / 歓迎要件 / 給与レンジ / 就業条件 …) を受け取り、求人票のドラフトを起草する。
- 既存 JD のリライト・トーン調整・多言語化 (JP / EN)。
- SEO と応募誘導を意識した見出し・冒頭文の生成。

### 入力
- 構造化: ポジション名、レベル、レポートライン、募集背景、必須スキル、歓迎スキル、想定年収、勤務地、雇用形態。
- 非構造化: 過去の JD、社内資料 (Google Drive)、募集背景の口頭メモ。

### 出力
- Markdown 形式の JD ドラフト。
- 差分適用時は `patch` ではなく完成版全体を返す (人間レビューを容易にするため)。

### 使用ツール
- `ryuki-mcp.jd_templates_search` — 過去 JD を職種で検索。
- `ryuki-mcp.jd_templates_save` — 完成版を再利用可能な形で保存。
- `Google_Drive.search_files` / `read_file_content` — 参考社内資料の取り込み。

### やらないこと
- ATS への公開 (Pipeline Analyst 経由でユーザー承認後に反映)。
- 給与レンジの決定 (人間が判断)。

---

## 2. Scout Writer Agent (スカウト文作成)

### 責務
- 特定候補者 (匿名 ID で参照) に対するスカウト文面を、媒体・ポジション・候補者のプロフィール要点を踏まえて生成。
- A/B バリエーション (件名 2 案・本文 2 案) を返す。
- 媒体規約に沿った文字数・記号制約を守る。

### 入力
- `job_id` (ryuki-mcp 内 ID)
- `candidate_id` (匿名 ID、氏名は含めない)
- `channel` (`wantedly` / `bizreach` / `linkedin` / `email`)
- 任意: トーン (`casual` / `formal`), 添付 (LP URL)

### 出力
- 件名 (複数案) + 本文 (複数案) の構造化データ。
- 各案について、なぜこの表現にしたかを 1 行で説明 (レビュー効率のため)。

### 使用ツール
- `ryuki-mcp.candidate_profile_get` — 属性 (経験年数・スキル・志向) を取得。氏名・連絡先は返さない。
- `ryuki-mcp.job_get` — 対応ポジション情報。
- `ryuki-mcp.scout_templates_search` — 実績のあるテンプレートの検索。

### やらないこと
- 実際の送信 (下書きまで)。送信は Scheduler Agent 経由で承認後に実行。

---

## 3. Sourcing Agent (v2: 候補者ソーシング) — 将来実装

### 責務
- 求人要件を検索クエリに変換し、スカウト媒体のロングリストを作成。
- レジュメの一次スクリーニング。

### 入力
- `job_id` と検索条件 (経験年数 / スキルタグ / 現職 / 勤務地)

### 出力
- 候補者 ID のロングリスト + 合致理由・懸念点。

### 使用ツール
- `ryuki-mcp.candidate_search` — 媒体横断検索。
- `mcp__github.search_users` — エンジニア候補の技術的裏取り。

### やらないこと
- 一次スクリーニング後の自動アプローチ (承認必須)。

---

## 4. Scheduler Agent (v2: 面接調整) — 将来実装

### 責務
- 候補者と面接官のカレンダーから空き時間を提案。
- 面接招待の送付、リマインダー、リスケ対応。
- 面接後の tldv 録画/書き起こしを引き当てて記録する。

### 使用ツール
- `mcp__Google_Calendar.suggest_time` / `create_event` / `update_event`
- `mcp__Gmail.create_draft` (原則ドラフト。ユーザー確認後送信)
- `mcp__tldv.search-meetings` / `get-meeting-transcript`
- `ryuki-mcp.application_update_stage`

---

## 5. Pipeline Analyst Agent (パイプライン管理・レポート)

### 責務
- 各求人の選考ステージ別の候補者数を集計。
- 週次 / 月次 KPI レポート (応募数、通過率、平均リードタイム、チャネル別 CPA、面接官負荷) の生成。
- 目標値との乖離アラート。

### 入力
- 集計期間 (`this_week` / `last_month` / 明示範囲)
- 対象求人フィルタ (未指定なら全件)

### 出力
- Markdown レポート (Slack にペースト可能な形式) + 補足の CSV / スプレッドシート URL。
- 明確な TL;DR を先頭に置く (「今週の応募数 42 件、前週比 +18%。Sales Manager だけ通過率が閾値割れ」)。

### 使用ツール
- `ryuki-mcp.pipeline_snapshot` — 現時点のステージ別カウント。
- `ryuki-mcp.pipeline_metrics` — 期間指定の集計。
- `mcp__Google_Drive.create_file` — レポートをスプレッドシートとして保存。

### やらないこと
- 数値の解釈だけで意思決定 (再現可能な根拠を必ず添える)。

---

## エージェント間の相互作用ルール

1. **Orchestrator を通さない直接呼び出しは禁止**。サブエージェントは他のサブエージェントを呼ばない。並行必要なら Orchestrator が並列に投げる。
2. **状態の共有はツール経由のみ**。エージェント間の暗黙のメモリを想定しない。次のエージェントに渡したい情報は ATS または ryuki-mcp のストアに永続化してから渡す。
3. **外向き I/O は承認必須**。メール送信、スカウト送信、ATS のステータス確定は必ずユーザー承認を挟む。
