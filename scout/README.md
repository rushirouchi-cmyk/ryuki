# オープンワーク自動スカウト

オープンワークリクルーティング (https://recruiting.vorkers.com) で、保存した検索条件に
ヒットする候補者へテンプレートスカウトを自動送付するスクリプト。毎朝 7:00 (JST) に
Claude Code の Routine (スケジュールトリガー) から実行される。

## 実行フロー

1. ログイン
2. 「スカウト」→「保存した検索条件」
3. 検索条件「旭化成ホームズ【東京／神奈川】集合住宅営業」を選択
4. 候補者ごとに: 詳細を開く → 「スカウトを送る」→ テンプレート
   「旭化成ホームズ【東京】集合住宅営業（未経験）」を選択 → 送付
5. 100件を超える場合は「次へ」でページ送りして続行
6. 「スカウト済み」表示のある候補者、および `sent-candidates.json` に記録済みの
   候補者はスキップ (重複送信防止)

## 使い方

```bash
cd scout

# 必須: ログイン情報 (環境変数 or Claude 環境の env 設定)
export OPENWORK_EMAIL='...'
export OPENWORK_PASSWORD='...'

# 動作確認 (送付ボタンは押さない)
npm run scout:dry

# 本番実行
npm run scout
```

### 環境変数

| 変数 | 既定値 | 説明 |
| --- | --- | --- |
| `OPENWORK_EMAIL` | (必須) | ログインメールアドレス |
| `OPENWORK_PASSWORD` | (必須) | ログインパスワード |
| `SEARCH_CONDITION_NAME` | 旭化成ホームズ【東京／神奈川】集合住宅営業 | 保存した検索条件名 |
| `TEMPLATE_NAME` | 旭化成ホームズ【東京】集合住宅営業（未経験） | スカウトテンプレート名 |
| `DRY_RUN` | (なし) | `1` で送付直前まで実行して止める |
| `MAX_SCOUTS` | 300 | 1回の実行で送る上限 |

## 出力

- `logs/run-<日時>/` — 各ステップのスクリーンショット、エラー時のHTMLダンプ (git管理外)
- `logs/result-<日付>.json` — 送信結果サマリー (git管理)
- `sent-candidates.json` — 送信済み台帳。実行のたびにコミットして翌日以降の重複送信を防ぐ (git管理)

## 定期実行 (Routine)

Claude Code Remote の Routine が毎日 22:00 UTC (= 7:00 JST) に新規セッションを起動し、
このスクリプトを実行 → 結果 (`logs/result-*.json` と `sent-candidates.json`) をコミット
& プッシュする。スクリプトが UI 変更などで失敗した場合、セッション内の Claude が
`logs/run-*/` のスクリーンショットとHTMLを見てセレクタ (`openwork-scout.js` の `UI`
オブジェクト) を修正し、リトライする運用。

## ⚠️ 前提: ネットワーク許可

Claude Code リモート環境のネットワークポリシーで **`recruiting.vorkers.com` への
アクセスを許可する必要がある**。許可されていない場合、プロキシが 403 を返し
ログインページに到達できない。claude.ai の環境設定 (Environment settings → Network
policy) でドメインを許可リストに追加するか、信頼済みネットワークポリシーに変更すること。

## セレクタが合わなくなったら

サイトのUI変更で要素が見つからなくなった場合は `openwork-scout.js` 冒頭の `UI`
オブジェクト (テキストの正規表現・CSSセレクタ) と `collectCandidateLinks()` の
URLパターンを実画面に合わせて調整する。失敗時は `logs/run-*/FAIL-*.png` /
`FAIL-*.html` に失敗時点の画面が残る。
