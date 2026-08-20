import { analyzeResults, buildSearchRankChanges, calculatePersistenceScore, calculateWeightedMetricScore, canCalculatePersistence, classifyObservationCoverage, isLikelyPrimary, normalizeUrl } from '../../lib/analysis'
import { canSpendBrave, recordApiUsage } from '../../lib/budget'
import { EN_US_PANEL, PUBLIC_PANEL_ID } from '../../lib/panels'
import { searchWeb } from '../../lib/provider'
import type { PagesContext } from '../../lib/types'
import { json } from '../../lib/validation'

const runTypes = ['scheduled', 'manual_official', 'verification'] as const
type RunType = typeof runTypes[number]
type PreviousPage = { query_id: string | null; domain: string; query: string; normalized_url: string; rank: number; title: string | null }
type PageRow = { queryId: string; domain: string; query: string; rank: number; url: string; normalizedUrl: string; hostname: string; title: string; snippet: string; clusterId: string | null; primaryLikelihood: number }

const hostnameOf = (raw: string) => { try { return new URL(raw).hostname.replace(/^www\./, '').toLowerCase() } catch { return 'unavailable' } }
const nowPlusDays = (value: string, days: number) => new Date(new Date(value).getTime() + days * 86400000).toISOString()
const runBatches = async (db: NonNullable<PagesContext['env']['ENTROPY_DB']>, statements: ReturnType<typeof db.prepare>[]) => { for (let index = 0; index < statements.length; index += 50) await db.batch(statements.slice(index, index + 50)) }
const metricList = (values: { originality: number; sourceHealth: number; diversity: number; persistence: number | null }, sampleSize: number) => Object.entries(values).map(([key, value]) => ({ key, value, label: key === 'originality' ? 'Uniqueness' : key === 'sourceHealth' ? 'Source Integrity' : key === 'diversity' ? 'Discovery Diversity' : 'Persistence', sampleSize, unit: value === null ? 'history required' : 'score / 100' }))

export const onRequestPost = async ({ request, env }: PagesContext) => {
  if (!env.OBSERVATION_CRON_SECRET || request.headers.get('Authorization') !== `Bearer ${env.OBSERVATION_CRON_SECRET}`) return json({ error: 'not found' }, 404)
  if (!env.ENTROPY_DB) return json({ error: 'database is not configured' }, 503)
  const panel = EN_US_PANEL
  const runTypeHeader = request.headers.get('X-Observation-Run-Type')
  const runType: RunType = runTypes.includes(runTypeHeader as RunType) ? runTypeHeader as RunType : 'verification'
  const runKey = request.headers.get('X-Observation-Run-Key') ?? crypto.randomUUID()
  const duplicate = await env.ENTROPY_DB.prepare('SELECT run_id FROM observation_run_context WHERE panel_id = ?1 AND run_key = ?2 LIMIT 1').bind(PUBLIC_PANEL_ID, runKey).first<{ run_id: string }>()
  if (duplicate) return json({ ok: true, duplicate: true, runId: duplicate.run_id, panelId: PUBLIC_PANEL_ID }, 200)
  const budget = await canSpendBrave(env.ENTROPY_DB, panel.queries.length, 'official')
  if (!budget.allowed) return json({ error: 'monthly Brave Search budget reached', panelId: PUBLIC_PANEL_ID, usage: budget.usage.requests, limit: budget.limit }, 429)

  const started = new Date().toISOString()
  const observedAt = new Date().toISOString()
  const runId = crypto.randomUUID()
  const previousPublicRun = await env.ENTROPY_DB.prepare("SELECT r.id, r.observed_at FROM observation_runs r JOIN observation_run_types t ON t.run_id = r.id AND t.panel_id = ?1 AND t.run_type IN ('scheduled', 'manual_official') JOIN observation_run_context c ON c.run_id = r.id AND c.run_status = 'completed' ORDER BY r.observed_at DESC LIMIT 1").bind(PUBLIC_PANEL_ID).first<{ id: string; observed_at: string }>()
  const previousPages = previousPublicRun ? await env.ENTROPY_DB.prepare('SELECT query_id, domain, query, normalized_url, rank, title FROM observation_pages WHERE run_id = ?1 ORDER BY query_id, rank').bind(previousPublicRun.id).all<PreviousPage>() : { results: [] as PreviousPage[] }
  const previousTop10 = previousPages.results.filter((page) => page.rank <= 10)
  const priorHistory = await env.ENTROPY_DB.prepare('SELECT normalized_url, result_state FROM url_verification_history WHERE panel_id = ?1 ORDER BY observed_at DESC').bind(PUBLIC_PANEL_ID).all<{ normalized_url: string; result_state: string }>()
  const webStates = new Map<string, string>()
  for (const row of priorHistory.results) if (!webStates.has(row.normalized_url)) webStates.set(row.normalized_url, row.result_state)
  const hasPageFetchMetadata = previousTop10.length > 0 && previousTop10.every((page) => webStates.has(page.normalized_url))
  const persistenceAvailable = canCalculatePersistence({ hasPreviousRun: Boolean(previousPublicRun), hasPageFetchMetadata })
  const earlierHistory = new Set((await env.ENTROPY_DB.prepare('SELECT DISTINCT normalized_url FROM search_rank_history WHERE panel_id = ?1').bind(PUBLIC_PANEL_ID).all<{ normalized_url: string }>()).results.map((row) => row.normalized_url))

  const audits: Array<{ queryId: string; domain: string; query: string; queryType: string; rationale: string; requestedCount: number; returnedCount: number; status: string; queryObservationStatus: string; top10Coverage: string; extendedTop20Coverage: string; score: number | null; top20Score: number | null; metrics: Record<string, number | null>; top10Metrics: Record<string, number | null>; top20Metrics: Record<string, number | null>; missingMetrics: string[]; errorReason: string | null }> = []
  const pageRows: PageRow[] = []
  const scores: Record<string, number[]> = {}
  const top20Scores: Record<string, number[]> = {}
  const normalizedUrls = new Set<string>()
  let duplicateNormalizedUrls = 0
  let apiRequests = 0

  for (let chunkStart = 0; chunkStart < panel.queries.length; chunkStart += 5) {
    const chunk = panel.queries.slice(chunkStart, chunkStart + 5)
    const results = await Promise.all(chunk.map(async (item) => {
      apiRequests += 1
      try {
        const response = await searchWeb(item.query, env, { count: panel.result_count, country: panel.country, searchLang: panel.search_lang, safeSearch: panel.safe_search })
        const result = analyzeResults(item.query, response.items, response.provider, panel.result_count)
        const priorForQuery = previousPages.results.filter((page) => page.query_id === item.id || (!page.query_id && page.query === item.query))
        const persistence = persistenceAvailable ? calculatePersistenceScore(priorForQuery.filter((page) => page.rank <= 10), result.pages.map((page, index) => ({ normalizedUrl: page.url, rank: index + 1 })), webStates) : null
        const top10MetricValues = { ...result.top10.metrics, persistence }
        const top20MetricValues = { ...result.top20.metrics, persistence }
        const top10Metrics = metricList(top10MetricValues, Math.min(10, result.totalResults))
        const top20Metrics = metricList(top20MetricValues, result.totalResults)
        const score = calculateWeightedMetricScore(top10Metrics)
        const top20Score = calculateWeightedMetricScore(top20Metrics)
        const pages: PageRow[] = result.pages.map((page, index) => ({ queryId: item.id, domain: item.domain, query: item.query, rank: index + 1, url: page.url, normalizedUrl: normalizeUrl(page.url), hostname: hostnameOf(page.url), title: page.title, snippet: response.items[index]?.description ?? '', clusterId: page.clusterId, primaryLikelihood: isLikelyPrimary(hostnameOf(page.url)) ? 1 : 0.2 }))
        const coverage = classifyObservationCoverage({ requestedCount: panel.result_count, returnedCount: result.totalResults })
        return { item, result, pages, score, top20Score: coverage.extendedTop20Coverage === 'available' ? top20Score : null, top10MetricValues, top20MetricValues, status: coverage.queryObservationStatus, ...coverage, errorReason: null }
      } catch {
        return { item, result: null, pages: [], score: null, top20Score: null, top10MetricValues: { originality: null, sourceHealth: null, diversity: null, persistence: null }, top20MetricValues: { originality: null, sourceHealth: null, diversity: null, persistence: null }, status: 'failed', ...classifyObservationCoverage({ requestedCount: panel.result_count, returnedCount: 0, providerFailed: true }), errorReason: 'Search provider request failed' }
      }
    }))
    for (const item of results) {
      const missingMetrics = Object.entries(item.top10MetricValues).filter(([, value]) => value === null).map(([key]) => key === 'originality' ? 'Uniqueness' : key === 'sourceHealth' ? 'Source Integrity' : key === 'diversity' ? 'Discovery Diversity' : 'Persistence')
      audits.push({ queryId: item.item.id, domain: item.item.domain, query: item.item.query, queryType: item.item.query_type, rationale: item.item.rationale, requestedCount: panel.result_count, returnedCount: item.result?.totalResults ?? 0, status: item.status, queryObservationStatus: item.queryObservationStatus, top10Coverage: item.top10Coverage, extendedTop20Coverage: item.extendedTop20Coverage, score: item.score, top20Score: item.top20Score, metrics: item.top10MetricValues, top10Metrics: item.top10MetricValues, top20Metrics: item.top20MetricValues, missingMetrics, errorReason: item.errorReason })
      if (item.score !== null) scores[item.item.domain] = [...(scores[item.item.domain] ?? []), item.score]
      if (item.top20Score !== null) top20Scores[item.item.domain] = [...(top20Scores[item.item.domain] ?? []), item.top20Score]
      pageRows.push(...item.pages)
      for (const page of item.pages) { if (normalizedUrls.has(page.normalizedUrl)) duplicateNormalizedUrls += 1; normalizedUrls.add(page.normalizedUrl) }
    }
  }

  const domainScores = Object.entries(scores).map(([domain, values]) => { const extended = top20Scores[domain] ?? []; return { domain, score: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length), top20Score: extended.length ? Math.round(extended.reduce((sum, value) => sum + value, 0) / extended.length) : null, pages: audits.filter((audit) => audit.domain === domain).reduce((sum, audit) => sum + audit.returnedCount, 0) } })
  const score = domainScores.length ? Math.round(domainScores.reduce((sum, item) => sum + item.score, 0) / domainScores.length) : null
  const availableTop20Scores = domainScores.filter((item): item is typeof item & { top20Score: number } => item.top20Score !== null)
  const top20Score = availableTop20Scores.length ? Math.round(availableTop20Scores.reduce((sum, item) => sum + item.top20Score, 0) / availableTop20Scores.length) : null
  const queryStats = { complete: audits.filter((audit) => audit.queryObservationStatus === 'complete').length, partial: audits.filter((audit) => audit.queryObservationStatus === 'partial').length, failed: audits.filter((audit) => audit.queryObservationStatus === 'failed').length }
  const runStatus = queryStats.failed === panel.queries.length ? 'failed' : 'completed'
  await env.ENTROPY_DB.prepare('INSERT INTO observation_runs (id, started_at, observed_at, score, analyzed_pages, calculation_version) VALUES (?1, ?2, ?3, ?4, ?5, ?6)').bind(runId, started, observedAt, score, pageRows.length, panel.methodology_version).run()
  await env.ENTROPY_DB.prepare('INSERT INTO observation_run_types (run_id, run_type, panel_id, classified_at) VALUES (?1, ?2, ?3, ?4)').bind(runId, runType, PUBLIC_PANEL_ID, observedAt).run()
  await env.ENTROPY_DB.prepare('INSERT INTO observation_run_labels (run_id, run_type, labeled_at) VALUES (?1, ?2, ?3)').bind(runId, runType, observedAt).run()
  await env.ENTROPY_DB.prepare('INSERT INTO observation_run_context (run_id, panel_id, panel_version, methodology_version, search_lang, country, ui_lang, safe_search, result_count, top10_score, top20_score, run_status, api_requests, created_at, run_key) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)').bind(runId, PUBLIC_PANEL_ID, panel.version, panel.methodology_version, panel.search_lang, panel.country, panel.ui_lang, panel.safe_search, panel.result_count, score, top20Score, runStatus, apiRequests, observedAt, runKey).run()
  await runBatches(env.ENTROPY_DB, domainScores.map((item) => env.ENTROPY_DB!.prepare('INSERT INTO observation_domain_scores (run_id, domain, score, analyzed_pages, observed_at, top20_score) VALUES (?1, ?2, ?3, ?4, ?5, ?6)').bind(runId, item.domain, item.score, item.pages, observedAt, item.top20Score)))
  await runBatches(env.ENTROPY_DB, audits.map((audit) => env.ENTROPY_DB!.prepare('INSERT INTO observation_queries (run_id, domain, query, requested_count, returned_count, status, score, metrics_json, missing_metrics, error_reason, observed_at, query_id, query_type, query_rationale, panel_id, top10_score, top20_score, top10_metrics_json, top20_metrics_json) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)').bind(runId, audit.domain, audit.query, audit.requestedCount, audit.returnedCount, audit.status, audit.score, JSON.stringify(audit.metrics), audit.missingMetrics.join(', '), audit.errorReason, observedAt, audit.queryId, audit.queryType, audit.rationale, PUBLIC_PANEL_ID, audit.score, audit.top20Score, JSON.stringify(audit.top10Metrics), JSON.stringify(audit.top20Metrics))))
  await runBatches(env.ENTROPY_DB, pageRows.map((page) => env.ENTROPY_DB!.prepare('INSERT INTO observation_pages (run_id, domain, query, rank, url, normalized_url, hostname, title, snippet, cluster_id, primary_likelihood, observed_at, query_id, panel_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)').bind(runId, page.domain, page.query, page.rank, page.url, page.normalizedUrl, page.hostname, page.title, page.snippet, page.clusterId, page.primaryLikelihood, observedAt, page.queryId, PUBLIC_PANEL_ID)))

  const currentRanked = pageRows.map((page) => ({ queryId: page.queryId, query: page.query, domain: page.domain, normalizedUrl: page.normalizedUrl, title: page.title, rank: page.rank }))
  const previousRanked = previousPages.results.map((page) => ({ queryId: page.query_id ?? '', query: page.query, domain: page.domain, normalizedUrl: page.normalized_url, title: page.title ?? '', rank: page.rank }))
  const previousByQuery = new Map<string, typeof previousRanked>()
  for (const page of previousRanked) previousByQuery.set(page.queryId || page.query, [...(previousByQuery.get(page.queryId || page.query) ?? []), page])
  const currentByQuery = new Map<string, typeof currentRanked>()
  for (const page of currentRanked) currentByQuery.set(page.queryId, [...(currentByQuery.get(page.queryId) ?? []), page])
  const scopedChanges = [...new Set(panel.queries.map((item) => item.id))].flatMap((queryId) => buildSearchRankChanges(previousByQuery.get(queryId) ?? [], currentByQuery.get(queryId) ?? [], earlierHistory))
  await runBatches(env.ENTROPY_DB, scopedChanges.map((change) => env.ENTROPY_DB!.prepare('INSERT INTO search_rank_history (run_id, previous_run_id, panel_id, query_id, query, domain, normalized_url, title, previous_rank, current_rank, search_status, observed_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)').bind(runId, previousPublicRun?.id ?? null, PUBLIC_PANEL_ID, change.queryId, change.query, change.domain, change.normalizedUrl, change.title, change.previousRank, change.currentRank, change.status, observedAt)))
  const dropped = scopedChanges.filter((change) => change.currentRank === null)
  await runBatches(env.ENTROPY_DB, pageRows.map((page) => env.ENTROPY_DB!.prepare(`INSERT INTO url_verification_queue (panel_id, normalized_url, last_seen_url, domain, query_id, query, first_observed_at, last_observed_at, next_verify_at, priority, consecutive_failures, web_status) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 1, 0, 'unverifiable') ON CONFLICT(panel_id, normalized_url) DO UPDATE SET last_seen_url = excluded.last_seen_url, domain = excluded.domain, query_id = excluded.query_id, query = excluded.query, last_observed_at = excluded.last_observed_at, next_verify_at = excluded.next_verify_at, priority = CASE WHEN url_verification_queue.web_status IN ('temporarily_unavailable','persistent_unavailable') THEN 3 ELSE 1 END`).bind(PUBLIC_PANEL_ID, page.normalizedUrl, page.url, page.domain, page.queryId, page.query, observedAt, observedAt, nowPlusDays(observedAt, 7))))
  await runBatches(env.ENTROPY_DB, dropped.map((change) => env.ENTROPY_DB!.prepare("UPDATE url_verification_queue SET next_verify_at = ?1, priority = 4 WHERE panel_id = ?2 AND normalized_url = ?3").bind(observedAt, PUBLIC_PANEL_ID, change.normalizedUrl)))
  await runBatches(env.ENTROPY_DB, dropped.map((change) => env.ENTROPY_DB!.prepare('INSERT INTO disappearance_events (panel_id, run_id, normalized_url, title, domain, query_id, query, previous_rank, last_seen_at, search_status, web_status, confidence, evidence, first_observed_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, COALESCE((SELECT web_status FROM url_verification_queue WHERE panel_id = ?1 AND normalized_url = ?3), \'unverifiable\'), \'low\', \'Search-result departure only; direct HTTP verification is required before calling this a web disappearance.\', COALESCE((SELECT first_observed_at FROM url_verification_queue WHERE panel_id = ?1 AND normalized_url = ?3), ?9), ?9)').bind(PUBLIC_PANEL_ID, runId, change.normalizedUrl, change.title, change.domain, change.queryId, change.query, change.previousRank, observedAt, change.status)))
  await env.ENTROPY_DB.prepare('UPDATE observation_run_context SET http_checks = 0, search_departures = ?1, web_disappearance_candidates = 0, confirmed_disappeared = 0 WHERE run_id = ?2').bind(dropped.length, runId).run()
  await recordApiUsage(env.ENTROPY_DB, { panelId: PUBLIC_PANEL_ID, purpose: 'official', runId, apiRequests })
  return json({ ok: true, duplicate: false, runId, panelId: PUBLIC_PANEL_ID, runType, isBaseline: runType === 'manual_official' && !previousPublicRun, methodologyVersion: panel.methodology_version, observedAt, score, top20Score, apiRequests, requestedQueries: panel.queries.length, analyzedPages: pageRows.length, resultCount: panel.result_count, duplicateNormalizedUrls, queryStats, searchDepartures: dropped.length, persistenceAvailable, domains: domainScores, queries: audits })
}
