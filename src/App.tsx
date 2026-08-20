import { FormEvent, useEffect, useState } from 'react'
import { emptyOfficialOverview, sampleExperiment } from './lib/sample'
import type { ExperimentResult, OfficialAudit, OfficialOverview } from './lib/types'

const stages = ['検索結果を取得', 'ページ情報を確認', '共通出典を探索', '類似グループを作成', '結果を集計']

const formatDate = (value: string | null) => (value ? new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '未観測')

function Icon({ name, size = 22 }: { name: 'search' | 'arrow' | 'info' | 'link' | 'grid' | 'clock' | 'source'; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  if (name === 'search') return <svg {...common}><circle cx="10.8" cy="10.8" r="6.5" /><path d="m16 16 5 5" /></svg>
  if (name === 'arrow') return <svg {...common}><path d="M4 12h15" /><path d="m13 6 6 6-6 6" /></svg>
  if (name === 'info') return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 10v6" /><path d="M12 7.5h.01" /></svg>
  if (name === 'link') return <svg {...common}><circle cx="7" cy="12" r="3" /><circle cx="17" cy="7" r="3" /><circle cx="17" cy="17" r="3" /><path d="m9.6 10.7 4.8-2.4M9.6 13.3l4.8 2.4" /></svg>
  if (name === 'grid') return <svg {...common}><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" /></svg>
  if (name === 'clock') return <svg {...common}><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></svg>
  return <svg {...common}><path d="M5 20V9l7-5 7 5v11" /><path d="M9 20v-6h6v6M7 10h.01M12 10h.01M17 10h.01" /></svg>
}

function SectionTitle({ number, children, eyebrow }: { number?: string; children: string; eyebrow?: string }) {
  return <div className="section-title"><div>{number && <span className="section-number">{number}</span>}<span className="section-eyebrow">{eyebrow}</span><h2>{children}</h2></div></div>
}

function LineageGraph({ result }: { result: ExperimentResult }) {
  const nodes = [
    { x: 36, y: 42, cluster: 'a', label: '1' }, { x: 36, y: 86, cluster: 'a', label: '2' }, { x: 36, y: 130, cluster: 'a', label: '3' },
    { x: 36, y: 174, cluster: 'b', label: '4' }, { x: 36, y: 218, cluster: 'b', label: '5' }, { x: 36, y: 262, cluster: 'c', label: '6' },
    { x: 36, y: 306, cluster: 'c', label: '7' }, { x: 36, y: 350, cluster: 'd', label: '8' }, { x: 36, y: 394, cluster: 'd', label: '9' }, { x: 36, y: 438, cluster: 'b', label: '10' },
  ]
  const clusterY: Record<string, number> = { a: 96, b: 210, c: 320, d: 430 }
  return <div className="lineage-graph" role="img" aria-label={`検索上位${result.totalResults}件を${result.lineageCount}つの情報系統にまとめた推定図`}>
    <svg viewBox="0 0 660 500" preserveAspectRatio="xMidYMid meet">
      <defs><filter id="softGlow"><feGaussianBlur stdDeviation="5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
      {nodes.map((node) => <path key={`line-${node.label}`} d={`M ${node.x + 16} ${node.y} C 180 ${node.y}, 210 ${clusterY[node.cluster]}, 288 ${clusterY[node.cluster]}`} className={`flow-line flow-${node.cluster}`} />)}
      {result.clusters.map((cluster, index) => <path key={`source-${cluster.id}`} d={`M 330 ${clusterY[cluster.id]} C 410 ${clusterY[cluster.id]}, 440 ${235 + index * 34}, 535 ${235 + index * 34}`} className="source-line" />)}
      {nodes.map((node) => <g key={node.label}><circle cx={node.x} cy={node.y} r="14" className="result-node" /><text x={node.x} y={node.y + 4} textAnchor="middle" className="node-label">{node.label}</text></g>)}
      {result.clusters.map((cluster) => <g key={cluster.id}><circle cx="315" cy={clusterY[cluster.id]} r="24" fill={cluster.color} opacity=".92" filter="url(#softGlow)" /><circle cx="315" cy={clusterY[cluster.id]} r="31" fill="none" stroke={cluster.color} strokeDasharray="3 4" /><text x="355" y={clusterY[cluster.id] + 5} className="cluster-label">{cluster.label}</text><text x="355" y={clusterY[cluster.id] + 23} className="cluster-count">{cluster.resultCount}件</text></g>)}
      <g><circle cx="557" cy="320" r="29" className="primary-node" /><path d="M548 330v-20l9-6 9 6v20M553 330v-10h8v10" className="primary-icon" /><text x="557" y="375" textAnchor="middle" className="primary-label">一次情報</text><text x="557" y="392" textAnchor="middle" className="primary-label">（推定）</text></g>
    </svg>
    <div className="graph-legend"><span><i className="legend-dot result" />検索結果</span><span><i className="legend-dot cluster" />情報系統</span><span><i className="legend-dot primary" />一次情報への到達</span></div>
  </div>
}

function MetricVisual({ type }: { type: string }) {
  if (type === '独自性') return <svg className="metric-visual" viewBox="0 0 180 96" aria-hidden="true"><path d="M12 18c22 0 22 60 44 60s22-60 44-60 22 60 44 60" className="metric-path teal" /><path d="M12 44c22 0 22 10 44 10s22-10 44-10 22 10 44 10" className="metric-path dim" /><circle cx="100" cy="18" r="5" className="metric-point" /></svg>
  if (type === '出典健全性') return <svg className="metric-visual" viewBox="0 0 180 96" aria-hidden="true"><circle cx="32" cy="48" r="19" className="source-circle" /><path d="M25 48h14M32 41v14" /><path d="M51 48h35M86 48l12-20M86 48l12 20" className="metric-path teal" /><circle cx="116" cy="28" r="10" className="source-small" /><circle cx="116" cy="68" r="10" className="source-small" /><path d="m112 28 3 3 6-7" className="check" /><path d="m112 68 3 3 6-7" className="check" /></svg>
  if (type === '発見多様性') return <svg className="metric-visual" viewBox="0 0 180 96" aria-hidden="true"><path d="M15 25h120M15 48h92M15 71h145" className="metric-bar" /><path d="M15 25h98M15 48h72M15 71h123" className="bar-fill" /><text x="150" y="29" className="metric-svg-label">A</text><text x="117" y="52" className="metric-svg-label">B</text><text x="163" y="75" className="metric-svg-label">C</text></svg>
  return <svg className="metric-visual" viewBox="0 0 180 96" aria-hidden="true"><path d="M17 48h142" className="metric-path dim" /><circle cx="36" cy="48" r="8" className="clock-dot teal-fill" /><circle cx="78" cy="48" r="8" className="clock-dot teal-fill" /><circle cx="120" cy="48" r="8" className="clock-dot amber-fill" /><circle cx="158" cy="48" r="8" className="clock-dot dim-fill" /><path d="M36 28v-8M78 28v-8M120 28v-8M158 28v-8" className="metric-path dim" /></svg>
}

function OfficialAuditPanel({ audit }: { audit: OfficialAudit }) {
  if (!audit.hasObservation) return null
  const success = audit.queries.filter((item) => item.status === 'success').length
  const partial = audit.queries.filter((item) => item.status === 'partial').length
  const failure = audit.queries.filter((item) => item.status === 'failure').length
  return <div className="audit-panel" aria-labelledby="audit-title"><div className="audit-header"><div><p className="eyebrow">OBSERVATION AUDIT / {audit.runId?.slice(0, 8)}</p><h3 id="audit-title">初回観測の内訳</h3></div><div className="audit-summary"><span className="audit-success">成功 {success}</span><span className="audit-partial">部分成功 {partial}</span><span className="audit-failure">失敗 {failure}</span><span>正規化URL重複 {audit.duplicateNormalizedUrls ?? 0}</span></div></div><div className="audit-table-wrap"><table className="audit-table"><caption className="sr-only">公式観測のクエリ別監査結果</caption><thead><tr><th>分野 / 検索語</th><th>取得</th><th>値</th><th>欠損</th><th>推定クラスタ / ホスト</th></tr></thead><tbody>{audit.queries.map((item) => <tr key={`${item.domain}-${item.query}`}><td><strong>{item.domain}</strong><span>{item.query}</span></td><td><span className={`audit-status ${item.status}`}>{item.status === 'success' ? '成功' : item.status === 'partial' ? '部分' : '失敗'}</span> {item.returned_count}/{item.requested_count}件</td><td>{item.score ?? '—'}<small>{item.score !== null ? '/100' : ''}</small></td><td>{item.missingMetrics.length ? item.missingMetrics.join('、') : 'なし'}</td><td>{item.clusters.length ? item.clusters.map((cluster) => <span className="cluster-audit" key={cluster.clusterId}>{cluster.clusterId} {cluster.pages}件 <small>{cluster.hostnames.join(', ')}</small></span>) : '—'}</td></tr>)}</tbody></table></div><p className="audit-footnote"><Icon name="info" size={15} /> スコアは取得できた指標だけで再配分。初回は持続性を欠損扱いにする。クラスタはタイトル・説明文・URLの共有トークン類似度による推定、一次情報らしさは公的・教育・国際機関ドメインのヒューリスティックです。取得不能ページは取得件数と部分成功へ反映し、0点には置き換えません。</p></div>
}

function App() {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<ExperimentResult>(sampleExperiment)
  const [official, setOfficial] = useState<OfficialOverview>(emptyOfficialOverview)
  const [audit, setAudit] = useState<OfficialAudit>({ hasObservation: false, queries: [] })
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'fallback'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [shareMessage, setShareMessage] = useState('')

  useEffect(() => {
    fetch('/api/observations').then(async (response) => response.ok ? setOfficial(await response.json() as OfficialOverview) : undefined).catch(() => undefined)
    fetch('/api/observations/latest').then(async (response) => response.ok ? setAudit(await response.json() as OfficialAudit) : undefined).catch(() => undefined)
  }, [])

  const runExperiment = async (event: FormEvent) => {
    event.preventDefault()
    const normalized = query.trim().replace(/\s+/g, ' ')
    if (normalized.length < 2 || normalized.length > 60) {
      setErrorMessage('検索語は2〜60文字で入力して。URLや個人情報は入力しないで。')
      return
    }
    setErrorMessage('')
    setShareMessage('')
    setStatus('running')
    try {
      const response = await fetch(`/api/live?q=${encodeURIComponent(normalized)}`, { headers: { Accept: 'application/json' } })
      if (!response.ok) throw new Error('live-unavailable')
      setResult(await response.json() as ExperimentResult)
      setStatus('done')
    } catch {
      setResult({ ...sampleExperiment, query: normalized, note: '検索Providerが未設定のため、保存済み代表観測を表示しています。これはライブ実測値ではありません。' })
      setStatus('fallback')
    }
  }

  const share = async () => {
    const text = `「${result.query}」の検索上位${result.totalResults}件を観測。実質的な情報系統は${result.lineageCount}つ、一次情報へ直接到達できたのは${result.primarySourceReach}件でした。`
    try { await navigator.clipboard.writeText(`${text}\n${window.location.href}#live`); setShareMessage('共有文をコピーした') } catch { setShareMessage(text) }
  }

  return <div className="app-shell">
    <header className="site-header"><a href="#top" className="brand">INTERNET <span>ENTROPY</span></a><nav aria-label="メインナビゲーション"><a href="#official">観測結果</a><a href="#method">方法論</a><a href="#sources">データソース</a><a href="#live" className="nav-action"><span>↗</span> 実験する</a></nav></header>
    <main id="top">
      <section className="hero-section" aria-labelledby="hero-title">
        <div className="hero-copy"><p className="kicker"><span className="live-dot" /> PUBLIC DATA EXPERIMENT / 01</p><h1 id="hero-title">検索結果は、<br /><em>何を映しているのか。</em></h1><p className="hero-subtitle">情報は増えている。知識は残っているか。</p><p className="hero-description">検索上位のページを、見かけの件数だけで終わらせない。共通する出典、似た文章、異なる情報系統をたどり、Webの変化を観測する。</p></div>
        <form className="experiment-form" id="live" onSubmit={runExperiment}><div className="form-label"><span className="step-index">01</span><span>検索語をひとつ入力</span><span className="form-note">匿名利用は1日3回まで</span></div><div className="search-row"><label className="search-input"><Icon name="search" size={25} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例：生成AI、タピオカ、最新ニュース" aria-label="観測する検索語" maxLength={60} /><span className="input-count">{query.length}/60</span></label><button className="primary-button" type="submit" disabled={status === 'running'}>{status === 'running' ? '観測中…' : 'ネットの情報系統を測定する'} <Icon name="arrow" size={21} /></button></div><p className="experiment-caption">検索語を1つ。上位結果から、見かけの件数と実質的な情報系統の差を見ます。</p>{errorMessage && <p className="form-error" role="alert"><Icon name="info" size={16} />{errorMessage}</p>}</form>
      </section>

      <section className="result-section" aria-labelledby="result-title"><div className="result-heading"><div><p className="eyebrow">{result.source === 'sample' || status === 'fallback' ? '保存済み代表観測 / サンプル表示' : 'あなたのライブ実験 / 取得結果'}</p><h2 id="result-title">{result.query || '生成AI'} <span className="result-mark">{status === 'done' ? 'LIVE' : 'SAMPLE'}</span></h2></div><div className="result-actions"><span className="observed-time">{status === 'done' ? `取得 ${formatDate(result.observedAt)}` : '2026.08.19 保存'}</span><button className="ghost-button" onClick={share}>共有する <Icon name="arrow" size={16} /></button></div></div><div className="result-grid"><div className="result-metrics"><div><span>解析対象</span><strong>{result.totalResults}<small>件</small></strong></div><div><span>情報系統</span><strong>{result.lineageCount}<small>つ</small></strong></div><div><span>一次情報への到達</span><strong>{result.primarySourceReach}<small>件</small></strong></div><div><span>高類似ページ</span><strong>{result.highSimilarityPairs}<small>組</small></strong></div></div><LineageGraph result={result} /></div><div className="result-footer"><span><Icon name="info" size={17} /> {result.note}</span><button className="text-button" onClick={share}>この結果を共有 <Icon name="arrow" size={16} /></button>{shareMessage && <span className="share-message" role="status">{shareMessage}</span>}</div></section>

      {status === 'running' && <section className="run-status" aria-live="polite"><span className="spinner" /><div><strong>観測処理を実行中</strong><p>{stages[0]}。完了した工程だけを表示する。</p></div></section>}

      <section className="official-section" id="official" aria-labelledby="official-title"><div className="official-header"><div><p className="eyebrow">01 / FIXED OBSERVATION</p><h2 id="official-title">公式定点観測</h2></div><p>運営側が固定した条件を、同じ方法で継続観測する。<br />ライブ実験の結果は、この時系列へ混ぜない。</p></div><div className="official-score"><div className="score-copy"><span className="score-label">観測Web健全度</span>{official.hasObservation && official.score !== null ? <strong>{official.score}<small>/100</small></strong> : <strong className="empty-score">—</strong>}<span className="score-note">{official.hasObservation ? `最終観測 ${formatDate(official.observedAt)}` : '初回観測後に表示'}</span></div><div className="score-ring"><div><span>{official.hasObservation ? `${official.score}` : '—'}</span><small>{official.hasObservation ? 'OBSERVED' : 'NO DATA'}</small></div></div><div className="official-stats"><div><span>完了した観測回数</span><strong>{official.completedRuns || '—'}</strong></div><div><span>累計解析ページ</span><strong>{official.analyzedPages ? official.analyzedPages.toLocaleString() : '—'}</strong></div><div><span>観測開始日</span><strong>{official.startDate ? formatDate(official.startDate).split(' ')[0] : '—'}</strong></div></div></div></section>

      <section className="method-section" id="method" aria-labelledby="method-title"><SectionTitle number="02" eyebrow="HOW WE READ THE RESULT">4つの指標で、情報の構造を読む。</SectionTitle><div className="metric-grid">{['独自性', '出典健全性', '発見多様性', '持続性'].map((label, index) => <article className="metric-card" key={label}><div className="metric-card-head"><span className="metric-no">0{index + 1}</span><h3>{label}</h3><span className="metric-status">推定</span></div><MetricVisual type={label} /><p>{label === '独自性' ? '同じ情報がどれだけ繰り返されているかではなく、内容の新しさを見ます。' : label === '出典健全性' ? '情報の出どころが明確で、検証可能かどうかを見ます。' : label === '発見多様性' ? '異なるドメインや運営主体から情報に出会えるかを見ます。' : '情報や出典が、時間の経過で残り続けるかを見ます。'}</p><span className="metric-bottom">{official.hasObservation ? '観測データあり' : '観測後に表示'} <Icon name="arrow" size={14} /></span></article>)}</div></section>

      <section className="domain-section" id="domains" aria-labelledby="domain-title"><div className="domain-copy"><p className="eyebrow">03 / FIXED OBSERVATION</p><h2 id="domain-title">分野別の比較</h2><p>同じ観測方法で、5分野の変化を並べて見る。ここに表示される値は、公式定点観測が蓄積してから更新される。</p><a href="#method" className="text-button">計算方法を見る <Icon name="arrow" size={16} /></a></div><div className="domain-chart">{official.domains.map((domain, index) => <div className="domain-row" key={domain.name}><span className="domain-index">0{index + 1}</span><span className="domain-name">{domain.name}</span><div className="bar-track"><div className="bar-value" style={{ width: `${domain.score ?? 0}%` }} /></div><strong>{domain.score ?? '—'}{domain.score !== null && <small>/100</small>}</strong></div>)}</div></section>

      <section className="sources-section" id="sources" aria-labelledby="sources-title"><div className="sources-header"><p className="eyebrow">04 / INFORMATION LINEAGE</p><h2 id="sources-title">情報のつながりを、推定する。</h2><p>検索結果をページの列ではなく、共通する一次資料や引用表現のつながりとして見る。断定できない関係には「推定」と表示する。</p></div><div className="lineage-explain"><div className="explain-node"><span className="node-icon"><Icon name="source" size={24} /></span><strong>一次情報の出典</strong><small>公的資料・発表資料</small></div><span className="explain-arrow">→</span><div className="explain-node"><span className="node-icon"><Icon name="link" size={24} /></span><strong>関連するページ群</strong><small>報道・解説・投稿</small></div><span className="explain-arrow">→</span><div className="explain-node"><span className="node-icon"><Icon name="grid" size={24} /></span><strong>派生した要約・引用</strong><small>まとめ・言及</small></div></div></section>
      <OfficialAuditPanel audit={audit} />
    </main>
    <footer className="site-footer"><div><a href="#top" className="brand">INTERNET <span>ENTROPY</span></a><p>情報の健やかさを、公開のデータで見つめる。</p></div><div className="footer-links"><a href="#method">方法論</a><a href="#sources">データソース</a><a href="#official">観測結果</a><a href="#top">限界と注意事項</a></div><div className="footer-note">観測Web健全度は、明示した観測範囲における指標です。<br />インターネット全体の測定値ではありません。</div></footer>
  </div>
}

export default App
