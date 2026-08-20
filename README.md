# INTERNET ENTROPY

検索結果は、何を映しているのか。

INTERNET ENTROPYは、検索上位ページの見かけの件数と、実質的な情報系統の差を継続観測する公開データ実験。インターネット全体の寿命・信頼性・汚染度を断定するサービスではない。

## MVPの範囲

- 日本語・日本国内を基本に5分野10クエリ、各クエリ上位10件を公式定点観測する
- ユーザーの検索語1つをライブ実験し、結果を4つ程度の情報系統へ推定クラスタリングする
- 公式定点観測とライブ実験をデータ・UI・時系列の両方で分離する
- 本文全文は恒久保存せず、URL正規化、タイトル、短い説明、ハッシュ・指標など最小限の特徴量を保持する
- 外部検索APIが未設定でも、保存済み代表観測のサンプル表示でサイト全体を動かす

## 技術構成

React + TypeScript + Viteをフロントエンドに採用。Cloudflare Pages Functionsから検索Providerを呼び、D1へ観測結果を保存する。定期観測はGitHub Actionsのscheduleから認証済みPages Functionを呼び出す。Cloudflare CronではなくGitHub Actionsを採用した理由は、クエリ設定・失敗ログ・再実行をリポジトリと同じ場所で確認でき、MVPで追加のWorkerを維持しなくてよいため。

### データフロー

1. ブラウザは検索語だけをPages Functionへ送る。APIキーは送らない
2. Functionが入力を検証し、同一検索語の30分キャッシュをD1から確認する
3. Brave Search APIが設定されていればサーバー側で上位10件を取得する。未設定時はサンプル結果へフォールバックする
4. URL・ドメイン・タイトル・説明の正規化とn-gramに近いトークン重複率でクラスタを作る
5. 結果JSONを短期キャッシュし、公式観測は別テーブルの時系列へ保存する

## 外部APIの選定

Google Trends APIは2026年時点でalphaの早期アクセス申請制のため、MVPの必須依存にしない。検索結果取得は、サーバー側Secretで呼べるBrave Search APIをProviderとして採用した。Braveの公式情報では検索APIは無料クレジットを含む従量制で、レート制限はレスポンスヘッダーで確認できる。検索結果の保存権・第三者ページの著作権は別途規約に従うため、本文再公開は行わない。

- Google Trends API alpha: https://developers.google.com/search/apis/trends
- Brave Search API: https://brave.com/search/api/
- Brave rate limiting: https://api-dashboard.search.brave.com/documentation/guides/rate-limiting

## D1スキーマ

`migrations/0001_initial.sql`に以下を定義する。

- `observation_runs`: 公式観測ジョブ、総合値、計算バージョン
- `observation_domain_scores`: 分野別の観測値
- `observation_pages`: 順位、URL、ドメイン、タイトル、HTTP結果、ハッシュ参照、クラスタ
- `observation_queries`: クエリ別の取得件数、成否、指標値、欠損理由
- `observation_run_labels`: 観測種別（`scheduled` / `manual_official` / `verification`）。既存runは削除せず、公開集計は前二者だけを対象にする
- `observation_page_changes`: 次回観測で前回の正式runと正規化URLを比較した追加・消失・継続・順位変動。リダイレクト・取得不能の列も持つ
- `live_runs`: ライブ実験の短期キャッシュ。ユーザー検索語は長期保存しない方針で、運用時に定期削除する

公式観測の説明可能性は `/api/observations/latest` で確認できる。クエリ別に取得件数、成否、欠損指標、推定クラスタ、ホスト名を返し、画面下部の「初回観測の内訳」に表示する。初回は検索結果APIのメタデータを対象にし、ページ本文を再取得しないため、HTTPステータス・本文ハッシュ・持続性は未計算として扱う。

D1の無料枠は公式料金ページの記載に従って確認する。2026年4月更新の公式ページでは、Free planに1日あたりrows read 5 million、rows written 100,000、合計5GBのストレージが含まれる。利用状況はCloudflare dashboardで確認する。

- D1 pricing: https://developers.cloudflare.com/d1/platform/pricing/
- Pages bindings: https://developers.cloudflare.com/pages/functions/bindings/

## 指標

初期計算バージョンは `mvp-1`。

- 独自性 30%: クラスタ数 / 解析ページ数
- 出典健全性 30%: 公的・教育・国際機関らしいドメインへの直接到達の割合
- 発見多様性 20%: 異なるホスト名 / 解析ページ数
- 持続性 20%: 初回は履歴不足のため欠損。2回目以降にHTTP状態・リダイレクト・本文ハッシュを使う

欠損値は無理に0点にせず、存在する指標だけで重みを再配分する。持続性が欠損する初回は3/4指標の重み合計で計算する。ただし公式観測が2回未満の間は前回比・トレンドを断定しない。AI生成疑いはMVPの総合値へ入れない。

## ローカル起動

```powershell
npm install
npm run dev
```

ブラウザで `http://127.0.0.1:5173/` を開く。APIが未起動でもUIはサンプル観測を表示する。

## テスト

```powershell
npm run lint
npm run typecheck
npm test -- --run
npm run build
npm audit --audit-level=high
```

## Cloudflare設定

1. `npm install -D wrangler`後、`npx wrangler login`でブラウザ認証する
2. `npx wrangler pages project create internet-entropy`でPagesプロジェクトを作る
3. `npx wrangler d1 create internet-entropy-db`でD1を作り、返却されたdatabase_idを本番設定へ登録する
4. `npx wrangler d1 migrations apply internet-entropy-db --remote`でmigrationを適用する
5. Pages Settings > Functions > D1 bindingでbinding名 `ENTROPY_DB` を接続する
6. PagesのSecretに `BRAVE_SEARCH_API_KEY` と `OBSERVATION_CRON_SECRET`を登録する。Brave APIキーはCloudflare Pagesだけに置き、GitHubへ複製しない。値はチャットやGitへ貼らない
7. `npx wrangler pages deploy dist --project-name internet-entropy`で公開する

`wrangler.jsonc`はPagesのビルド出力と公開非機密変数だけを管理する。DB IDやSecretは認証後にCloudflare側へ設定する。

## 定期観測

`.github/workflows/official-observation.yml`が毎週月曜02:17 UTCに `/api/admin/observe`を呼ぶ。GitHub Actions Secretとして登録するのは `OBSERVATION_CRON_SECRET`だけで、Brave APIキーは登録しない。手動実行はworkflow_dispatchから行う。`.github/workflows/brave-diagnostic.yml`は同じCron Secretで保護されたPages `/api/admin/diagnose` を呼び、Pages側のBrave Secretで1検索語を診断する。

## ライブ実験の制限

- 入力は検索語のみ、2〜60文字
- 匿名利用は同一検索語につき1日1回相当のCache API制限
- 上位10件まで、取得タイムアウト8秒
- 30分間の結果キャッシュ
- Provider未設定・API障害時は保存済み代表観測として表示し、ライブ実測と誤認させない

## セキュリティとデータ保持

任意URLの取得機能は実装しないため、ライブ実験からのSSRF経路を作らない。入力はサーバー側でも検証し、SQLはprepared statementを使う。セキュリティヘッダー、CSP、フレーム拒否、Referrer-Policy、Permissions-PolicyをPages Middlewareで付ける。IPは永続保存しない。検索語の短期キャッシュは運用で削除する。

## 既知の制約

- Brave Search APIが未設定の環境ではライブ検索はサンプル表示になる
- 本文取得・robots.txtの個別判定・HTTP死活の定期比較はDBの器までをMVPに含め、初回の検索体験では実行しない
- クラスタリングはタイトル・説明・URLの安価な類似推定であり、意味の同一性を証明しない
- 公式観測が2回未満の間は、持続性と時系列の解釈ができない

## English long-term panel

The default public series is `en-us-core-v1`: English-language search in the United States, moderate SafeSearch, and up to 20 web results per query. The fixed 50-query registry lives in `config/panels/en-us-core-v1.json`; each query has an ID, category, selection reason, type, active date, and panel version. The previous Japanese series remains under `legacy-ja` and is never used as the English panel's previous observation.

The main score uses Top 10 results. Top 20 is stored and shown as a supporting view so concentration in the most discoverable results can be compared with the search-result fringe. Each category has ten queries: four evergreen, two primary-source, two current-affairs, and two rewrite-heavy.

The monthly Brave budget is capped at 1,000 requests. Official observations use their fixed 50-request allowance; live search has a separate 300-request reserve and stops without inventing measured numbers when the reserve is unavailable. Application usage is recorded in `api_usage_ledger`.

`search_rank_history` records search-result departure separately from direct page status. `url_verification_queue` controls the next check and priority; `url_verification_history` stores HTTP status, final URL, redirect count, content type, title hash, optional body hash, robots result, retry count, and state. A single failure is temporary. Repeated 404/410 becomes disappeared, repeated 5xx/timeout becomes persistent unavailable, and a reachable URL with changed title/body is only a replacement candidate.
