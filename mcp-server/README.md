# ryuki-mcp

採用業務ドメイン固有の MCP サーバー。

**現在**: Phase 0 (設計中)。実装コードはまだない。

**次のステップ**: `../docs/mcp-tools.md` のツール仕様を確定させ、Phase 1 スコープ (JD テンプレート系 + pipeline 集計系) から実装着手する。

## 予定ディレクトリ構成

```
mcp-server/
├── pyproject.toml
├── src/
│   └── ryuki_mcp/
│       ├── server.py            # MCP エントリポイント
│       ├── tools/
│       │   ├── jd_templates.py
│       │   ├── scout_templates.py
│       │   ├── jobs.py
│       │   ├── candidates.py
│       │   ├── applications.py
│       │   ├── scouts.py
│       │   ├── pipeline.py
│       │   └── audit.py
│       ├── providers/
│       │   ├── base.py          # ATS 抽象化 interface
│       │   ├── greenhouse.py
│       │   ├── lever.py
│       │   └── herp.py
│       ├── models/              # pydantic モデル
│       ├── storage/             # SQLite / 暗号化 PII
│       └── config.py
└── tests/
```

## 実装着手前チェックリスト

- [ ] 契約中の ATS を確定 (どのプロバイダを最初に対応するか)
- [ ] シークレット管理方式の確定
- [ ] PII 暗号鍵の運用ルール策定
- [ ] 監査ログ保管先の確定 (SQLite で十分か / 監査要件が別途あるか)
