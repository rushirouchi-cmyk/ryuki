# ryuki — 採用代行エージェント

社内の採用代行 (RPO: Recruitment Process Outsourcing) 業務を、Claude を中心とした AI エージェント群で実行するためのプロジェクト。

## スコープ (v1)

コア機能として以下 2 領域を先行実装する。

1. **求人票・スカウト文の作成**
   - JD (Job Description) 生成
   - スカウトメール文面生成 (媒体別・ペルソナ別)
2. **パイプライン管理・レポート**
   - 選考ステージの進捗集計
   - 週次 KPI レポート生成 (応募数 / 通過率 / TAT / チャネル別 CPA など)

将来的に「候補者ソーシング」「面接調整」を段階的に追加する。

## 実装形態

- **MCP サーバー** (`mcp-server/`): 採用業務ドメイン固有のツール群を提供する。
  - ATS (Greenhouse / Lever / HERP) 操作
  - スカウト媒体 (Wantedly / BizReach / LinkedIn) 操作
  - JD / スカウトテンプレートの保管・検索
  - KPI 集計クエリ
- **プロンプト集** (`prompts/`): 各業務タスク用のシステムプロンプト・Few-shot 例を集めたテンプレート集。
- **既存 MCP サーバー活用**: Gmail / Google Calendar / Google Drive / tldv / GitHub は既存 MCP を利用する。

## ドキュメント

| ドキュメント | 内容 |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | 全体アーキテクチャとコンポーネント構成 |
| [docs/agent-responsibilities.md](docs/agent-responsibilities.md) | サブエージェントの責務分担 |
| [docs/data-flow.md](docs/data-flow.md) | 業務プロセスごとのデータフロー |
| [docs/mcp-tools.md](docs/mcp-tools.md) | 自作 MCP サーバーが提供するツール仕様 |
| [docs/data-model.md](docs/data-model.md) | 求人・候補者・選考プロセスのデータモデル |
| [docs/prompts.md](docs/prompts.md) | プロンプト設計方針とテンプレート一覧 |
| [docs/roadmap.md](docs/roadmap.md) | フェーズ別の実装ロードマップ |

## ステータス

**設計フェーズ (2026-07)**: v0 設計ドキュメントを整備中。実装着手前レビューを想定。
