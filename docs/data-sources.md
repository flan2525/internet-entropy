# データソース

## 検索結果

MVPのProviderはBrave Search API。APIキーはPages FunctionのSecretからのみ読み、クライアントへ返さない。検索結果のURL・タイトル・短い説明を解析し、本文全文は保存・再配信しない。

## トレンド

Google Trends APIはalphaの早期アクセス申請制。必須依存にせず、将来の `TrendProvider` 追加候補として扱う。

## 取得ポリシー

任意URL入力は受け付けない。公式観測でページ取得を拡張する場合はHEAD後に限定GET、リダイレクト先再検証、8秒タイムアウト、同一ホストへの間隔制限、User-Agentと問い合わせ先の明示、robots.txtと利用規約の尊重を実装する。
