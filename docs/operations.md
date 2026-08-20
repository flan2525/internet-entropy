# 運用

## 初回セットアップ

Cloudflareにログイン後、PagesプロジェクトとD1を作成し、migrationをremoteへ適用する。PagesのD1 binding名は `ENTROPY_DB`。BraveのSecretは `BRAVE_SEARCH_API_KEY`、定期観測の認証Secretは `OBSERVATION_CRON_SECRET`。

## 観測

GitHub Actionsの週次scheduleが認証済みFunctionを呼ぶ。失敗時は一部クエリだけの成功を保存せず、ジョブレスポンスとCloudflareログで原因を確認する。クエリは `config/observation-queries.json`で管理し、変更時は計算バージョンまたは観測条件を記録する。

初回確認では、Actionsの成功表示だけで完了としない。レスポンスの `requestedQueries`・`apiRequests`・`queryStats`・`duplicateNormalizedUrls` と、D1の `observation_runs`・`observation_queries`・`observation_pages` を同じ `runId` で突き合わせる。`/api/observations/latest` ではクエリ別の取得件数、成否、欠損指標、クラスタ、ホスト名を確認する。`observation_runs` / `observation_pages` と `live_runs` は別テーブルであり、公式観測へライブキャッシュを混ぜない。

Brave Search APIの当該実行のアプリケーション側消費量は、固定クエリ数と `apiRequests` で確認する。アカウント全体の月間残量・請求額はBraveのAPI Dashboardで確認し、APIキー自体はログ・レスポンス・静的配信物へ出さない。

## キャッシュと保持

ライブ結果は30分のD1キャッシュ。匿名レート制限はCache APIで同一IP・検索語を日次相当で抑える。IPはD1へ保存しない。`live_runs`は必要最小限の期間で削除する。
