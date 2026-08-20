import type { RuntimeEnv, SearchItem } from './types'

export class ProviderUnavailable extends Error {}

export type SearchOptions = { count?: number; country?: string; searchLang?: string; safeSearch?: 'off' | 'moderate' | 'strict' }

export const searchWeb = async (query: string, env: RuntimeEnv, options: SearchOptions = {}): Promise<{ items: SearchItem[]; provider: 'brave'; requestedCount: number; responseResultCount: number }> => {
  if (!env.BRAVE_SEARCH_API_KEY) throw new ProviderUnavailable('search provider is not configured')
  const url = new URL('https://api.search.brave.com/res/v1/web/search')
  url.searchParams.set('q', query)
  const requestedCount = Math.min(20, Math.max(1, options.count ?? 20))
  url.searchParams.set('count', String(requestedCount))
  url.searchParams.set('country', (options.country ?? 'US').toLowerCase())
  url.searchParams.set('search_lang', options.searchLang ?? 'en')
  url.searchParams.set('safesearch', options.safeSearch ?? 'moderate')
  url.searchParams.set('text_decorations', 'false')
  const response = await fetch(url, { headers: { Accept: 'application/json', 'X-Subscription-Token': env.BRAVE_SEARCH_API_KEY }, signal: AbortSignal.timeout(8000) })
  if (!response.ok) throw new ProviderUnavailable(`provider status ${response.status}`)
  const data = await response.json() as { web?: { results?: Array<{ title?: string; url?: string; description?: string; age?: string }> } }
  const webResults = data.web?.results ?? []
  const items = webResults.filter((item): item is { title: string; url: string; description?: string; age?: string } => Boolean(item.title && item.url)).slice(0, requestedCount).map((item) => ({ title: item.title, url: item.url, description: item.description ?? '', age: item.age }))
  if (items.length === 0) throw new ProviderUnavailable('provider returned no results')
  return { items, provider: 'brave', requestedCount, responseResultCount: webResults.length }
}
