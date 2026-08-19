# 運用

## 初回セットアップ

Cloudflareにログイン後、PagesプロジェクトとD1を作成し、migrationをremoteへ適用する。PagesのD1 binding名は `ENTROPY_DB`。BraveのSecretは `BRAVE_SEARCH_API_KEY`、定期観測の認証Secretは `OBSERVATION_CRON_SECRET`。

## 観測

GitHub Actionsの週次scheduleが認証済みFunctionを呼ぶ。失敗時は一部クエリだけの成功を保存せず、ジョブレスポンスとCloudflareログで原因を確認する。クエリは `config/observation-queries.json`で管理し、変更時は計算バージョンまたは観測条件を記録する。

## キャッシュと保持

ライブ結果は30分のD1キャッシュ。匿名レート制限はCache APIで同一IP・検索語を日次相当で抑える。IPはD1へ保存しない。`live_runs`は必要最小限の期間で削除する。
