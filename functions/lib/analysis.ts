import type { MetricKey, SearchItem } from './types'

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'what', 'when', 'where', 'how', 'why', 'about', 'into', 'your', 'best', 'guide', 'news',
  'です', 'ます', 'する', 'こと', 'ため', 'から', 'まで', 'について', '情報', '最新', '解説', 'まとめ',
])
const COLORS = ['#42c7b5', '#e7b75b', '#5794d0', '#a08de0']

export type AnalysisWindow = {
  resultCount: number
  distinctDomains: number
  lineageCount: number
  primarySourceReach: number
  highSimilarityPairs: number
  metrics: Record<'originality' | 'sourceHealth' | 'diversity', number>
}

export type RankedPage = { queryId: string; query: string; domain: string; normalizedUrl: string; title: string; rank: number }
export type SearchChangeStatus = 'still_ranked' | 'rank_changed' | 'dropped_from_top_10' | 'dropped_from_top_20' | 'newly_ranked' | 'returned_to_results'
export type SearchRankChange = RankedPage & { previousRank: number | null; currentRank: number | null; status: SearchChangeStatus }

const domainOf = (raw: string) => { try { return new URL(raw).hostname.replace(/^www\./, '').toLowerCase() } catch { return 'unavailable' } }
const normalize = (value: string) => value.toLowerCase().replace(/[「」『』。、！？,.!?()（）【】]/g, ' ').replaceAll('[', ' ').replaceAll(']', ' ').replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim()
const tokens = (value: string) => normalize(value).split(/\s+/).filter((token) => token.length > 1 && !STOP_WORDS.has(token)).slice(0, 24)
const similarity = (a: string, b: string) => { const left = new Set(tokens(a)); const right = new Set(tokens(b)); const union = new Set([...left, ...right]).size; return union ? [...left].filter((token) => right.has(token)).length / union : 0 }

export const normalizeUrl = (raw: string) => { try { const url = new URL(raw); url.hash = ''; url.hostname = url.hostname.toLowerCase(); if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, ''); return url.toString() } catch { return raw } }
export const classifyHttpStatus = (status: number | 'timeout') => status === 'timeout' ? 'timeout' : status >= 200 && status < 300 ? 'ok' : status >= 300 && status < 400 ? 'redirect' : status >= 400 && status < 500 ? 'client_error' : 'server_error'
export const isLikelyPrimary = (hostname: string) => /\.(gov|mil|edu)$|\.go\.jp$|\.ac\.jp$|(^|\.)gov\.|who\.int$|un\.org$|census\.gov$|nasa\.gov$|nist\.gov$/.test(hostname)

const METRIC_WEIGHTS: Record<MetricKey, number> = { originality: 0.3, sourceHealth: 0.3, diversity: 0.2, persistence: 0.2 }
export const calculateWeightedMetricScore = (metrics: Array<{ key: MetricKey; value: number | null }>) => {
  const available = metrics.filter((metric) => metric.value !== null)
  const availableWeight = available.reduce((sum, metric) => sum + METRIC_WEIGHTS[metric.key], 0)
  return availableWeight ? Math.round(available.reduce((sum, metric) => sum + (metric.value ?? 0) * METRIC_WEIGHTS[metric.key], 0) / availableWeight) : null
}

export const PERSISTENCE_REQUIREMENTS = { minimumPublicHistoryRuns: 1, requiresPageFetchMetadata: true, bodyHashCalculated: true } as const
export const canCalculatePersistence = (input: { hasPreviousRun: boolean; hasPageFetchMetadata: boolean }) => input.hasPreviousRun && input.hasPageFetchMetadata
export const persistenceWebScore = (status: string) => ({ alive: 100, moved: 85, redirected: 85, replaced_candidate: 60, temporarily_unavailable: 50, persistent_unavailable: 25, disappeared: 0 } as Record<string, number>)[status] ?? null
export const calculatePersistenceScore = (previousTop10: Array<{ normalizedUrl: string; rank: number }>, currentTop20: Array<{ normalizedUrl: string; rank: number }>, webStates: Map<string, string>) => {
  const current = new Map(currentTop20.map((page) => [page.normalizedUrl, page.rank]))
  const values = previousTop10.map((page) => {
    const rank = current.get(page.normalizedUrl)
    const searchScore = rank === undefined ? 0 : rank <= 10 ? 100 : 70
    const webScore = persistenceWebScore(webStates.get(page.normalizedUrl) ?? '')
    return webScore === null ? null : Math.round((searchScore + webScore) / 2)
  }).filter((value): value is number => value !== null)
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null
}

const analyzeWindow = (items: SearchItem[]): AnalysisWindow => {
  const groups: Array<{ items: SearchItem[]; key: string }> = []
  for (const item of items) { const matching = groups.find((group) => similarity(`${item.title} ${item.description}`, `${group.items[0].title} ${group.items[0].description}`) >= .22); if (matching) matching.items.push(item); else groups.push({ items: [item], key: String.fromCharCode(97 + groups.length) }) }
  const domains = items.map((item) => domainOf(item.url))
  const primarySourceReach = items.filter((item) => isLikelyPrimary(domainOf(item.url))).length
  return {
    resultCount: items.length,
    distinctDomains: new Set(domains).size,
    lineageCount: groups.length,
    primarySourceReach,
    highSimilarityPairs: groups.filter((group) => group.items.length > 1).reduce((sum, group) => sum + group.items.length - 1, 0),
    metrics: { originality: Math.round(100 * groups.length / Math.max(1, items.length)), sourceHealth: Math.round(100 * primarySourceReach / Math.max(1, items.length)), diversity: Math.round(100 * new Set(domains).size / Math.max(1, items.length)) },
  }
}

export const analyzeResults = (query: string, items: SearchItem[], provider: 'brave' | 'sample', resultCount = 20) => {
  const limited = items.slice(0, resultCount)
  const top10Items = limited.slice(0, 10)
  const top10 = analyzeWindow(top10Items)
  const top20 = analyzeWindow(limited)
  const metrics = { ...top10.metrics, persistence: null as number | null }
  const label = (key: string) => key === 'originality' ? 'Uniqueness' : key === 'sourceHealth' ? 'Source Integrity' : key === 'diversity' ? 'Discovery Diversity' : 'Persistence'
  const top10MetricList = Object.entries(metrics).map(([key, value]) => ({ key: key as MetricKey, label: label(key), value, definition: '', sampleSize: top10Items.length, unit: value === null ? 'history required' : 'score / 100' }))
  const groups: Array<{ items: SearchItem[]; key: string }> = []
  for (const item of limited) { const matching = groups.find((group) => similarity(`${item.title} ${item.description}`, `${group.items[0].title} ${group.items[0].description}`) >= .22); if (matching) matching.items.push(item); else groups.push({ items: [item], key: String.fromCharCode(97 + groups.length) }) }
  return {
    query, source: provider, observedAt: new Date().toISOString(), totalResults: limited.length, distinctDomains: top10.distinctDomains, lineageCount: top10.lineageCount, primarySourceReach: top10.primarySourceReach, highSimilarityPairs: top10.highSimilarityPairs, unavailableCount: Math.max(0, resultCount - limited.length),
    metrics: top10MetricList,
    top10: { ...top10, score: calculateWeightedMetricScore(top10MetricList) },
    top20: { ...top20, score: calculateWeightedMetricScore(Object.entries({ ...top20.metrics, persistence: null as number | null }).map(([key, value]) => ({ key: key as MetricKey, value }))) },
    clusters: groups.map((group, index) => ({ id: group.key, label: `Lineage ${String.fromCharCode(65 + index)}`, resultCount: group.items.length, color: COLORS[index % COLORS.length], primarySource: group.items[0].title, confidence: 'estimated' as const })),
    pages: limited.map((item, index) => ({ title: item.title, domain: domainOf(item.url), clusterId: groups.find((group) => group.items.includes(item))?.key ?? 'a', sourceType: index === 0 ? 'search result' : 'related page', url: normalizeUrl(item.url) })),
    note: 'Estimated from search-result titles, descriptions, and URLs. Page bodies are not republished.',
  }
}

export const buildSearchRankChanges = (previous: RankedPage[], current: RankedPage[], hadEarlierHistory: Set<string> = new Set()) => {
  const previousByUrl = new Map(previous.map((page) => [page.normalizedUrl, page]))
  const currentByUrl = new Map(current.map((page) => [page.normalizedUrl, page]))
  const changes: SearchRankChange[] = []
  for (const page of current) {
    const prior = previousByUrl.get(page.normalizedUrl)
    let status: SearchChangeStatus
    if (!prior) status = hadEarlierHistory.has(page.normalizedUrl) ? 'returned_to_results' : 'newly_ranked'
    else if (prior.rank === page.rank) status = 'still_ranked'
    else status = 'rank_changed'
    changes.push({ ...page, previousRank: prior?.rank ?? null, currentRank: page.rank, status })
  }
  for (const page of previous) {
    if (currentByUrl.has(page.normalizedUrl)) continue
    changes.push({ ...page, previousRank: page.rank, currentRank: null, status: page.rank <= 10 ? 'dropped_from_top_10' : 'dropped_from_top_20' })
  }
  return changes
}

export const makeSampleResult = (query: string) => analyzeResults(query, [
  { title: `${query} overview`, url: 'https://example.org/overview', description: `${query} explained with background and context` },
  { title: `${query} guide`, url: 'https://example.com/guide', description: `${query} explained with background and context` },
  { title: `${query} official information`, url: 'https://www.gov.example/official', description: 'Public source information' },
  { title: `${query} research`, url: 'https://research.example.edu/paper', description: 'Research and evidence' },
  { title: `${query} comparison`, url: 'https://review.example.net/comparison', description: `${query} review and comparison` },
  { title: `${query} explained`, url: 'https://news.example.org/explained', description: `${query} explained with background and context` },
  { title: `${query} facts`, url: 'https://facts.example.net/facts', description: `${query} facts and summary` },
  { title: `${query} report`, url: 'https://report.example.com/report', description: `${query} report and summary` },
  { title: `${query} checklist`, url: 'https://guide.example.org/checklist', description: `${query} checklist` },
  { title: `${query} data`, url: 'https://data.example.gov/data', description: 'Public data source' },
], 'sample', 20)
