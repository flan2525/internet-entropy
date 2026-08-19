import type { RuntimeEnv, SearchItem } from './types'

export class ProviderUnavailable extends Error {}

export const searchWeb = async (query: string, env: RuntimeEnv): Promise<{ items: SearchItem[]; provider: 'brave' }> => {
  if (!env.BRAVE_SEARCH_API_KEY) throw new ProviderUnavailable('search provider is not configured')
  const url = new URL('https://api.search.brave.com/res/v1/web/search')
  url.searchParams.set('q', query)
  url.searchParams.set('count', '10')
  url.searchParams.set('country', 'jp')
  url.searchParams.set('search_lang', 'ja')
  const response = await fetch(url, { headers: { Accept: 'application/json', 'X-Subscription-Token': env.BRAVE_SEARCH_API_KEY }, signal: AbortSignal.timeout(8000) })
  if (!response.ok) throw new ProviderUnavailable(`provider status ${response.status}`)
  const data = await response.json() as { web?: { results?: Array<{ title?: string; url?: string; description?: string; age?: string }> } }
  const items = (data.web?.results ?? []).filter((item): item is { title: string; url: string; description?: string; age?: string } => Boolean(item.title && item.url)).slice(0, 10).map((item) => ({ title: item.title, url: item.url, description: item.description ?? '', age: item.age }))
  if (items.length === 0) throw new ProviderUnavailable('provider returned no results')
  return { items, provider: 'brave' }
}
