# セキュリティ

- APIキーはCloudflare Secretのみ。フロントエンド、Git、レスポンス、通常ログへ出さない
- 任意URL取得を提供しないため、ユーザー入力を起点にしたSSRFを避ける
- 入力はクライアントとFunctionの両方で2〜60文字に制限し、URL・メール・電話番号らしき値を拒否する
- SQLはD1 prepared statementで実行する
- `X-Content-Type-Options`、`X-Frame-Options`、CSP、`Referrer-Policy`、`Permissions-Policy`を設定する
- エラーは内部情報を含めず、Provider障害と設定不足をUI上で区別する
