import { analyzeResults, classifyPrimarySource, normalizeUrl } from '../lib/analysis'
import { canSpendBrave, recordApiUsage, recordLiveUsage } from '../lib/budget'
import { EN_US_PANEL, PUBLIC_PANEL_ID } from '../lib/panels'
import { classifyVerificationFailure, verifyUrl } from '../lib/url-verification'
import { searchWeb } from '../lib/provider'
import type { LivePageEvidence, PagesContext, SearchItem } from '../lib/types'
import { json } from '../lib/validation'

const locales: Record<string, { country: string; searchLang: string }> = { en: { country: 'US', searchLang: 'en' }, 'zh-CN': { country: 'CN', searchLang: 'zh-hans' }, ja: { country: 'JP', searchLang: 'ja' }, de: { country: 'DE', searchLang: 'de' }, ru: { country: 'RU', searchLang: 'ru' } }
const cacheTtl = (query: string) => EN_US_PANEL.queries.find((item) => item.query.toLowerCase() === query.toLowerCase())?.query_type === 'current_affairs' ? 3600 : 86400
const isTop10LiveResult = (value: unknown): value is { totalResults: number; searchResultsRetrieved: number; fullPagesRetrieved: number; fullPagesUnavailable: number; pages: unknown[]; clusters: unknown[]; top20: null } => {
  if (!value || typeof value !== 'object') return false
  const result = value as Record<string, unknown>
  return result.top20 === null && typeof result.totalResults === 'number' && result.totalResults <= 10 && typeof result.searchResultsRetrieved === 'number' && result.searchResultsRetrieved <= 10 && typeof result.fullPagesRetrieved === 'number' && typeof result.fullPagesUnavailable === 'number' && result.fullPagesRetrieved + result.fullPagesUnavailable === result.searchResultsRetrieved && Array.isArray(result.pages) && result.pages.length <= 10 && Array.isArray(result.clusters)
}
const emptyResult = (query: string, note: string) => ({ query, source: 'sample' as const, observedAt: new Date().toISOString(), totalResults: 0, distinctDomains: 0, lineageCount: 0, primarySourceReach: 0, highSimilarityPairs: 0, unavailableCount: 0, metrics: [], top10: null, top20: null, clusters: [], pages: [], note, searchResultsRetrieved: 0, fullPagesRetrieved: 0, fullPagesUnavailable: 0, snippetOnlyResults: 0, fullContentResults: 0, primarySourceEvaluableResults: 0, primarySourceUnevaluableResults: 0, qualityLevel: 'insufficient_data' as const, primarySourceAssessment: 'not_evaluable' as const, similarityGroupCount: 0, similarityGroupResultCount: 0, independentResultCount: 0, analysisBasis: 'search_snippets' as const, primarySourceCandidates: [], fetchFailureReasons: {}, limitations: [note] })

const fetchPageEvidence = async (query: string, items: SearchItem[]) => {
  const evidence = new Map<string, LivePageEvidence>()
  for (let index = 0; index < items.length; index += 3) {
    const chunk = items.slice(index, index + 3)
    const results = await Promise.all(chunk.map(async (item) => {
      const result = await verifyUrl({ url: item.url, previousStatus: 'unverifiable', previousFailures: 0 })
      const fullContent = Boolean(result.bodyHash && ['alive', 'moved', 'replaced_candidate'].includes(result.state))
      const failureReason = fullContent ? undefined : classifyVerificationFailure(result)
      return { item, fullContent, failureReason, primaryConfidence: classifyPrimarySource(query, item, { fullContent, primaryConfidence: 'unevaluable', failureReason }) }
    }))
    for (const result of results) evidence.set(normalizeUrl(result.item.url), { fullContent: result.fullContent, failureReason: result.failureReason, primaryConfidence: result.primaryConfidence })
  }
  return evidence
}

const limited = async (request: Request, query: string, locale: string) => {
  try {
    const cache = caches.default
    const key = new Request(`https://entropy-rate.invalid/${encodeURIComponent(`${request.headers.get('CF-Connecting-IP') ?? 'anonymous'}:${locale}:${query}`)}`)
    if (await cache.match(key)) return false
    await cache.put(key, new Response('1', { headers: { 'Cache-Control': 'max-age=86400' } }))
  } catch { /* Cache API is optional in local dev. */ }
  return true
}

const latestOfficialItems = async (env: PagesContext['env'], query: string) => {
  if (!env.ENTROPY_DB) return null
  const registry = await env.ENTROPY_DB.prepare('SELECT query_id FROM observation_query_registry WHERE panel_id = ?1 AND lower(query) = lower(?2) AND enabled = 1 LIMIT 1').bind(PUBLIC_PANEL_ID, query).first<{ query_id: string }>()
  if (!registry) return null
  const run = await env.ENTROPY_DB.prepare("SELECT r.id FROM observation_runs r JOIN observation_run_types t ON t.run_id = r.id AND t.panel_id = ?1 AND t.run_type IN ('scheduled','manual_official') JOIN observation_run_context c ON c.run_id = r.id AND c.run_status = 'completed' ORDER BY r.observed_at DESC LIMIT 1").bind(PUBLIC_PANEL_ID).first<{ id: string }>()
  if (!run) return null
  const pages = await env.ENTROPY_DB.prepare('SELECT title, url, snippet FROM observation_pages WHERE run_id = ?1 AND query_id = ?2 ORDER BY rank').bind(run.id, registry.query_id).all<{ title: string; url: string; snippet: string }>()
  return pages.results.length ? pages.results.map((page) => ({ title: page.title, url: page.url, description: page.snippet })) satisfies SearchItem[] : null
}

export const onRequestGet = async ({ request, env }: PagesContext) => {
  const url = new URL(request.url)
  const query = url.searchParams.get('q')?.trim().replace(/\s+/g, ' ')
  const locale = url.searchParams.get('lang') ?? 'en'
  const setting = locales[locale] ?? locales.en
  if (!query || query.length < 2 || query.length > 80 || /https?:\/\//i.test(query) || /@/.test(query)) return json({ error: 'Enter a search phrase between 2 and 80 characters. URLs and personal information are not allowed.' }, 400)
  if (!(await limited(request, query, locale))) return json({ error: 'The anonymous daily limit has been reached.', result: emptyResult(query, 'No new search was made because the anonymous usage limit was reached.') }, 429, { 'Cache-Control': 'no-store' })
  const ttl = cacheTtl(query)
  const officialItems = locale === 'en' ? await latestOfficialItems(env, query) : null
  if (officialItems) {
    const liveResults = officialItems.slice(0, 10)
    const result = { ...analyzeResults(query, liveResults, 'brave', liveResults.length, new Map(), false), providerResultsRetrieved: officialItems.length }
    const officialResult = { ...result, source: 'official' as const, note: 'Reusing the latest official US English observation for this query. This live interaction does not add to the observation series.' }
    if (env.ENTROPY_DB) { await recordApiUsage(env.ENTROPY_DB, { panelId: PUBLIC_PANEL_ID, purpose: 'live', cacheHits: 1 }); await recordLiveUsage(env.ENTROPY_DB, { started: 1, completed: 1, failed: 0, cacheHits: 1, apiRequests: 0, shared: 0, language: locale }) }
    return json(officialResult, 200, { 'Cache-Control': `public, max-age=${Math.min(21600, ttl)}` })
  }
  const cached = env.ENTROPY_DB ? await env.ENTROPY_DB.prepare('SELECT result_json FROM live_runs WHERE query = ?1 AND search_lang = ?2 AND country = ?3 AND created_at > datetime(\'now\', ?4) ORDER BY created_at DESC LIMIT 1').bind(query, setting.searchLang, setting.country, `-${ttl} seconds`).first<{ result_json: string }>() : null
  if (cached?.result_json) {
    try {
      const cachedResult = JSON.parse(cached.result_json)
      if (isTop10LiveResult(cachedResult)) {
        if (env.ENTROPY_DB) { await recordApiUsage(env.ENTROPY_DB, { panelId: null, purpose: 'live', cacheHits: 1 }); await recordLiveUsage(env.ENTROPY_DB, { started: 1, completed: 1, failed: 0, cacheHits: 1, apiRequests: 0, shared: 0, language: locale }) }
        return json(cachedResult, 200, { 'Cache-Control': `public, max-age=${ttl}` })
      }
    } catch { /* Ignore legacy or malformed cache entries and make a fresh bounded search. */ }
  }
  const budget = env.ENTROPY_DB ? await canSpendBrave(env.ENTROPY_DB, 1, 'live') : { allowed: true, usage: { requests: 0 }, limit: 700 }
  if (!budget.allowed) {
    if (env.ENTROPY_DB) await recordLiveUsage(env.ENTROPY_DB, { started: 1, completed: 0, failed: 1, cacheHits: 0, apiRequests: 0, shared: 0, language: locale })
    return json({ error: 'The monthly search budget is reserved for official observations. No measured result is shown.', result: emptyResult(query, 'The monthly search budget is currently reserved for official observations. Try again later.') }, 429, { 'Cache-Control': 'no-store' })
  }
  try {
    const response = await searchWeb(query, env, { count: 20, country: setting.country, searchLang: setting.searchLang, safeSearch: 'moderate' })
    const liveResults = response.items.slice(0, 10)
    const evidence = await fetchPageEvidence(query, liveResults)
    const result = { ...analyzeResults(query, liveResults, 'brave', liveResults.length, evidence, false), providerResultsRetrieved: response.responseResultCount }
    if (env.ENTROPY_DB) {
      await env.ENTROPY_DB.prepare('INSERT INTO live_runs (query, source, result_json, created_at, search_lang, country, cache_ttl_seconds) VALUES (?1, ?2, ?3, datetime(\'now\'), ?4, ?5, ?6)').bind(query, result.source, JSON.stringify(result), setting.searchLang, setting.country, ttl).run()
      await recordApiUsage(env.ENTROPY_DB, { panelId: null, purpose: 'live', apiRequests: 1 })
      await recordLiveUsage(env.ENTROPY_DB, { started: 1, completed: 1, failed: 0, cacheHits: 0, apiRequests: 1, shared: 0, language: locale })
    }
    return json(result, 200, { 'Cache-Control': `public, max-age=${ttl}` })
  } catch {
    if (env.ENTROPY_DB) await recordLiveUsage(env.ENTROPY_DB, { started: 1, completed: 0, failed: 1, cacheHits: 0, apiRequests: 1, shared: 0, language: locale })
    return json({ error: 'The search provider was unavailable. No invented measurement is shown.', result: emptyResult(query, 'The search provider was unavailable, so no measured result is displayed.') }, 502)
  }
}
