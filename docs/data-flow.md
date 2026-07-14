# データフロー

主要 3 業務プロセスのデータフローを図示する。

## Flow A: 求人票作成

```
採用担当  ─┐
          │  「Sales Manager の JD を作って」
          ▼
   Orchestrator ─► JD Author Agent
                        │
                        ├─► ryuki-mcp.jd_templates_search(role="Sales Manager")
                        │        └─► 過去 JD 3 件を要点だけ返す
                        │
                        ├─► Google_Drive.search_files(query="Sales 事業計画")
                        │        └─► 事業計画資料を取得 (トークン節約のため要約)
                        │
                        └─► LLM で JD ドラフト生成
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │ 採用担当がレビュー・編集    │
                    └──────────────┬───────────┘
                                   │  承認
                                   ▼
                        ryuki-mcp.jd_templates_save
                                   │
                                   ▼
                        (任意) ATS.publish_job
```

**設計ポイント**
- 過去 JD は「全文」ではなく「見出しと決めのフレーズだけ」を渡す。フルテキストを渡すとコンテキストが破裂する。
- 承認前に ATS へは書かない。

---

## Flow B: スカウト送信 (承認フロー)

```
採用担当 ─┐
         │  「Job#123 で候補者 C-456 に BizReach でスカウト作って」
         ▼
   Orchestrator ─► Scout Writer Agent
                        │
                        ├─► ryuki-mcp.job_get(job_id="123")
                        ├─► ryuki-mcp.candidate_profile_get(candidate_id="C-456")
                        │        └─► 氏名・連絡先はマスクして属性のみ返す
                        ├─► ryuki-mcp.scout_templates_search(channel="bizreach")
                        │
                        └─► LLM で件名 2 案 + 本文 2 案を生成
                                 │
                                 ▼
                     採用担当がレビュー → 案を選択 → 微修正
                                 │
                                 ▼
                    ryuki-mcp.scout_send(
                        channel="bizreach",
                        candidate_id="C-456",
                        subject=..., body=...
                    )
                                 │
                                 ▼
                    ryuki-mcp.audit_log.append(
                        action="scout_sent",
                        actor="rushirouchi@gmail.com",
                        subject_hash=..., body_hash=...
                    )
```

**設計ポイント**
- Scout Writer はスカウトを送らない。送信は必ず `scout_send` ツール呼び出し 1 発を経由し、その 1 箇所で監査ログを書く。
- 本文に候補者氏名を含めたければ、送信時に ryuki-mcp が `{{candidate_name}}` プレースホルダを実名に差し替える。LLM は実名を扱わない。

---

## Flow C: 週次パイプラインレポート

```
[Cron / Slack コマンド]
          │
          ▼
   Orchestrator ─► Pipeline Analyst Agent
                        │
                        ├─► ryuki-mcp.pipeline_snapshot()
                        │        └─► ATS を叩いて現ステージ別カウントを返す
                        │
                        ├─► ryuki-mcp.pipeline_metrics(period="last_7d")
                        │        └─► 応募数・通過率・TAT を返す
                        │
                        ├─► ryuki-mcp.pipeline_metrics(period="prev_7d")
                        │        └─► 比較用の前週数値
                        │
                        └─► LLM で TL;DR + テーブル + アラート生成
                                 │
                                 ▼
                    Google_Drive.create_file(...)  ← CSV / スプレッドシート
                                 │
                                 ▼
                    採用担当に Markdown で返答
                    (Slack ペースト可能な形式)
```

**設計ポイント**
- LLM に生 SQL を書かせない。集計は ryuki-mcp のツール側で完結し、LLM はナラティブ生成だけ担当する。数値の再現性と PII 保護のため。
- 前週比は比較のためだけの数値。「なぜ増えたか / 減ったか」の解釈は事実に基づく仮説として提示し、断定しない。

---

## Flow D: 面接調整 (v2)

概略のみ (詳細は v2 で確定)。

```
Orchestrator ─► Scheduler Agent
                        │
                        ├─► Google_Calendar.suggest_time(attendees=[面接官])
                        ├─► Gmail.create_draft(候補者宛の候補日提示メール)
                        │        └─► ユーザー承認後に送信
                        │
     (候補者返信) ────────┤
                        │
                        ├─► Google_Calendar.create_event
                        └─► ryuki-mcp.application_update_stage(next="1次面接")
```

---

## 共通ルール

- **PII は上流に流さない**: 氏名・連絡先は ryuki-mcp 内でトークン化し、エージェント (LLM) は ID で扱う。実名が必要な差し込みは送信時にツール側で復号する。
- **監査ログは末端で 1 回だけ書く**: 途中経路で分散すると欠落する。外部 I/O ツールが自分で書く。
- **失敗時のリトライは冪等な単位で行う**: `scout_send` は `idempotency_key` を必ず受け取る。
