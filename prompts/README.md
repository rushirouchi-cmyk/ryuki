# prompts/

サブエージェント用のシステムプロンプト・Few-shot 例集。

**現在**: Phase 0 (設計中)。プロンプト本体はまだ書いていない。

設計方針は `../docs/prompts.md` を参照。

## Phase 1 で作成するファイル

- `orchestrator.md`
- `jd_author.md`
- `pipeline_analyst.md`

## Phase 2 追加

- `scout_writer.md`

## Phase 3-4 追加

- `sourcing.md`
- `scheduler.md`

## フォーマット

各ファイルは Markdown で、以下の見出しを持つ。

```markdown
# <エージェント名>

## system
(システムプロンプト本体)

## few_shots
(3-5 件の入出力例)

## anti_examples
(やってはいけない出力とその理由)

## changelog
- YYYY-MM-DD: 何を変えたか
```
