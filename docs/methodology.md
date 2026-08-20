# 方法論

## 何を測るか

明示した検索語・地域・言語・取得件数の範囲で、検索上位ページの独自性、出典健全性、発見多様性、持続性を観測する。これはWeb情報環境の一部を切り取った観測であり、インターネット全体の測定値ではない。

## 情報系統の推定

URL、ホスト名、タイトル、説明文を正規化し、共有トークンのJaccard類似度を使って候補クラスタを作る。共通出典や一次資料へのリンクは、検索結果APIで得られるメタデータの範囲で補助的に扱う。表示上の関係は「推定」とし、情報源の真の系譜を断定しない。

## 総合値

総合値は、独自性30%、出典健全性30%、発見多様性20%、持続性20%の重み付き平均。欠損指標は0点で埋めず分母から外し、利用可能な指標へ元の重みを再配分する。たとえば持続性が欠損なら、残り3指標の重み合計80%を分母として正規化するため、画面では「3/4指標で算出」と明示する。利用可能な指標が2つ未満の場合は値を表示しない。計算変更時は `calculation_version` を変え、異なる版を同一時系列へ混ぜない。

公式観測では、クエリごとに取得件数・Query observation status・Top 10 coverage・Extended Top 20 coverage・4指標の値・欠損理由を保存する。10件以上取得できれば主観測は `complete`、1〜9件は `partial`、0件は `failed`。Top 10 coverageは10件以上を `complete`、1〜9件を `partial`、0件を `unavailable` とする。Extended Top 20は20件以上を `available`、11〜19件を `partial`、10件以下を `unavailable` とする。Braveへ20件を要求しても11〜20件取得のための追加paginationは行わず、Top 10を正式観測、Top 20を将来拡張として扱う。取得不能ページを0点のページとして扱わない。発見多様性のクラスタはタイトル・説明文・URLの共有トークン類似度による推定で、同じクラスタになった理由をページ群のホスト名とともに監査API・画面で追える。出典健全性の一次情報らしさは、公的・教育・国際機関ドメインを優先するヒューリスティックであり、真の出典系譜を断定しない。

持続性を計算できる条件は、(1)同じクエリに対する前回の正式観測runが存在し、(2)現在と前回のページ取得メタデータが存在すること。現在は検索APIのメタデータだけを保存し、本文を再取得していないため、持続性は `null` のままにする。本文ハッシュや内容変更を推定値で埋めない。URL正規化後の追加・消失・継続・順位変動は `observation_page_changes` に保存できるが、リダイレクト・取得不能はページ取得を有効化するまで未計算とする。将来これらを計算する場合は観測条件と `calculation_version` を更新する。

公開時系列は `scheduled` と `manual_official` のrunだけで構成する。同日に行った開発検証runは `verification` としてD1に残すが、正式観測回数、前回比、累計解析ページ、最新公開値には含めない。

## エントロピーという語

エントロピーは観測仮説と概念的フレーム。熱力学第二法則がそのままWebへ適用されると主張しない。放置された情報環境でリンクが切れ、出典が失われ、複製と変形が積み重なると、知識の秩序を維持するコストが増える可能性がある。その変化を限定された範囲から継続記録する。

## 参考文献

- [Nature (2024) — AI models collapse when trained on recursively generated data](https://www.nature.com/articles/s41586-024-07566-y)
- [Pew Research Center (2024) — When Online Content Disappears](https://www.pewresearch.org/data-labs/2024/05/17/when-online-content-disappears/)

前者のモデル崩壊と検索結果の重複・風化を同一現象とは断定しない。後者の調査結果を本プロジェクトの現在値へ外挿しない。

## English panel and disappearance rules

The default series is `en-us-core-v1`, using US English search settings and 50 fixed queries. The Japanese observations are retained as `legacy-ja`; they are not used as the previous run, denominator, cumulative page count, or trend for the English panel. Top 10 is the primary score and Top 20 is a supporting comparison.

When a later official run returns 11〜20 results, those pages are stored as a new supplementary Top 20 observation. They are not treated as newly appeared or rank-shifted pages against a baseline that only contained Top 10. Official rank history and persistence use the common Top 10 range until a comparable extended baseline exists.

Search-result departure means that a URL leaves the observed Top 10 or Top 20. It is not called web disappearance. Web status comes only from a direct, SSRF-checked HTTP verification: a first timeout/5xx is `temporarily_unavailable`; repeated failure is `persistent_unavailable`; repeated 404/410 is `disappeared`; a reachable different final URL is `moved`; a reachable page with a changed title or available body hash is `replaced_candidate`; robots or network restrictions are `blocked` or `unverifiable`.

The default verification cadence is: current Top 20 every weekly run, URLs that left the previous Top 20 on the next verification pass, older live URLs monthly, and disappearance candidates for two or three consecutive checks. Redirects are followed manually with a maximum of five hops, and every redirect target is rechecked against the public-URL SSRF policy. The verifier rejects localhost, private/link-local IP literals, metadata hosts, credentials in URLs, unsupported protocols, and unsafe redirect targets.

Persistence becomes calculable only when a previous official run exists and direct page-fetch metadata exists for the previous Top 10 URLs. It combines search retention with the observed web state. Body hashes are recorded only when a bounded HTML/text GET succeeds; they are never inferred. AI-generation classification is out of scope.

Live search is a separate product cache and is never mixed into official observation counts. The provider may return up to 20 results, but live analysis uses `providerResults.slice(0, 10)` only: clustering, lineage estimation, primary-source assessment, page retrieval, counts, and share snapshots are all bounded to the live Top 10. It reports provider-returned count separately from live analysis count, bounded page-body retrieval, snippet-only results, primary-source evaluability, and failure reasons. `snippet_only` means no page body was available; similarity groups and information lineages are provisional and based on snippets, and primary-source assessment is `Not evaluable`. `mixed_content` means 1〜9 page bodies were retrieved, and `full_content` means every live result had bounded body evidence. Top 20 pagination is intentionally not requested in live or official search when the provider returns fewer than 20.
