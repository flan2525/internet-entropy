import { analyzeResults, calculateWeightedMetricScore, normalizeUrl } from '../../lib/analysis'
import { searchWeb } from '../../lib/provider'
import type { PagesContext } from '../../lib/types'
import { json } from '../../lib/validation'

const queries = [
  { domain: '医療・健康', query: '睡眠 改善 方法' }, { domain: '医療・健康', query: '花粉症 対策' },
  { domain: '災害・防災', query: '防災 備蓄' }, { domain: '災害・防災', query: '南海トラフ 地震' },
  { domain: '科学・技術', query: '生成AI 仕組み' }, { domain: '科学・技術', query: '再生可能エネルギー' },
  { domain: 'ニュース・時事', query: '選挙 仕組み' }, { domain: 'ニュース・時事', query: '物価 上昇 理由' },
  { domain: '製品レビュー', query: 'ノートパソコン 選び方' }, { domain: '製品レビュー', query: 'ワイヤレスイヤホン 比較' },
]

const hostnameOf = (raw: string) => { try { return new URL(raw).hostname.replace(/^www\./, '').toLowerCase() } catch { return '取得不能' } }
const primaryLikelihood = (hostname: string) => /\.go\.jp$|\.ac\.jp$|\.gov\.|who\.int$|un\.org$/.test(hostname) ? 1 : 0.2

export const onRequestPost = async ({ request, env }: PagesContext) => {
  if (!env.OBSERVATION_CRON_SECRET || request.headers.get('Authorization') !== `Bearer ${env.OBSERVATION_CRON_SECRET}`) return json({ error: 'not found' }, 404)
  if (!env.ENTROPY_DB) return json({ error: 'database is not configured' }, 503)
  const started = new Date().toISOString()
  const observedAt = new Date().toISOString()
  const runId = crypto.randomUUID()
  const audits: Array<{ domain: string; query: string; requestedCount: number; returnedCount: number; status: string; score: number | null; metrics: Record<string, number | null>; missingMetrics: string[]; errorReason: string | null }> = []
  const pageRows: Array<{ domain: string; query: string; rank: number; url: string; normalizedUrl: string; hostname: string; title: string; snippet: string; clusterId: string | null; primaryLikelihood: number }> = []
  const scores: Record<string, number[]> = {}
  const normalizedUrls = new Set<string>()
  let duplicateNormalizedUrls = 0
  let apiRequests = 0

  for (const item of queries) {
    apiRequests += 1
    try {
      const response = await searchWeb(item.query, env)
      const result = analyzeResults(item.query, response.items, response.provider)
      const values = Object.fromEntries(result.metrics.map((metric) => [metric.key, metric.value])) as Record<string, number | null>
      const score = calculateWeightedMetricScore(result.metrics)
      const missingMetrics = result.metrics.filter((metric) => metric.value === null).map((metric) => metric.label)
      const status = result.totalResults === 10 ? 'success' : 'partial'
      audits.push({ domain: item.domain, query: item.query, requestedCount: 10, returnedCount: result.totalResults, status, score, metrics: values, missingMetrics, errorReason: null })
      if (score !== null) scores[item.domain] = [...(scores[item.domain] ?? []), score]
      const clusterByUrl = new Map(result.pages.map((page) => [normalizeUrl(page.url), page.clusterId]))
      response.items.forEach((page, index) => {
        const normalizedUrl = normalizeUrl(page.url)
        if (normalizedUrls.has(normalizedUrl)) duplicateNormalizedUrls += 1
        normalizedUrls.add(normalizedUrl)
        const hostname = hostnameOf(page.url)
        pageRows.push({ domain: item.domain, query: item.query, rank: index + 1, url: page.url, normalizedUrl, hostname, title: page.title, snippet: page.description, clusterId: clusterByUrl.get(normalizedUrl) ?? null, primaryLikelihood: primaryLikelihood(hostname) })
      })
    } catch {
      audits.push({ domain: item.domain, query: item.query, requestedCount: 10, returnedCount: 0, status: 'failure', score: null, metrics: { originality: null, sourceHealth: null, diversity: null, persistence: null }, missingMetrics: ['独自性', '出典健全性', '発見多様性', '持続性'], errorReason: '検索Providerの取得失敗' })
    }
  }

  const domainScores = Object.entries(scores).map(([domain, values]) => ({ domain, score: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length), pages: audits.filter((audit) => audit.domain === domain).reduce((sum, audit) => sum + audit.returnedCount, 0) }))
  const score = domainScores.length ? Math.round(domainScores.reduce((sum, item) => sum + item.score, 0) / domainScores.length) : null
  await env.ENTROPY_DB.prepare('INSERT INTO observation_runs (id, started_at, observed_at, score, analyzed_pages, calculation_version) VALUES (?1, ?2, ?3, ?4, ?5, ?6)').bind(runId, started, observedAt, score, pageRows.length, 'mvp-1').run()
  await env.ENTROPY_DB.batch(domainScores.map((item) => env.ENTROPY_DB!.prepare('INSERT INTO observation_domain_scores (run_id, domain, score, analyzed_pages, observed_at) VALUES (?1, ?2, ?3, ?4, ?5)').bind(runId, item.domain, item.score, item.pages, observedAt)))
  await env.ENTROPY_DB.batch(audits.map((audit) => env.ENTROPY_DB!.prepare('INSERT INTO observation_queries (run_id, domain, query, requested_count, returned_count, status, score, metrics_json, missing_metrics, error_reason, observed_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)').bind(runId, audit.domain, audit.query, audit.requestedCount, audit.returnedCount, audit.status, audit.score, JSON.stringify(audit.metrics), audit.missingMetrics.join('、'), audit.errorReason, observedAt)))
  await env.ENTROPY_DB.batch(pageRows.map((page) => env.ENTROPY_DB!.prepare('INSERT INTO observation_pages (run_id, domain, query, rank, url, normalized_url, hostname, title, snippet, cluster_id, primary_likelihood, observed_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)').bind(runId, page.domain, page.query, page.rank, page.url, page.normalizedUrl, page.hostname, page.title, page.snippet, page.clusterId, page.primaryLikelihood, observedAt)))
  return json({ ok: true, runId, observedAt, score, apiRequests, requestedQueries: queries.length, analyzedPages: pageRows.length, duplicateNormalizedUrls, queryStats: { success: audits.filter((audit) => audit.status === 'success').length, partial: audits.filter((audit) => audit.status === 'partial').length, failure: audits.filter((audit) => audit.status === 'failure').length }, domains: domainScores, queries: audits })
}
