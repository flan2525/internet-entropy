import { canSpendBrave, recordApiUsage } from '../../lib/budget'
import { searchWeb } from '../../lib/provider'
import type { PagesContext } from '../../lib/types'
import { json } from '../../lib/validation'

const DIAGNOSTIC_QUERY = 'how to improve sleep'

export const isCronAuthorized = (request: Request, secret?: string) => Boolean(secret && request.headers.get('Authorization') === `Bearer ${secret}`)

export const onRequestPost = async ({ request, env }: PagesContext) => {
  if (!isCronAuthorized(request, env.OBSERVATION_CRON_SECRET)) return json({ error: 'not found' }, 404)
  if (!env.BRAVE_SEARCH_API_KEY) return json({ error: 'provider is not configured' }, 503)
  if (env.ENTROPY_DB) {
    const budget = await canSpendBrave(env.ENTROPY_DB, 1, 'diagnostic')
    if (!budget.allowed) return json({ error: 'monthly Brave Search budget reached' }, 429)
  }
  try {
    const response = await searchWeb(DIAGNOSTIC_QUERY, env, { count: 20, country: 'US', searchLang: 'en', safeSearch: 'moderate' })
    if (env.ENTROPY_DB) await recordApiUsage(env.ENTROPY_DB, { purpose: 'diagnostic', apiRequests: 1 })
    const top20Availability = response.responseResultCount >= 20 ? 'available' : response.responseResultCount > 10 ? 'partial' : 'unavailable'
    return json({ ok: true, httpStatus: 200, requestedCount: response.requestedCount, braveWebResultsCount: response.responseResultCount, validResultCount: response.items.length, top10Count: Math.min(10, response.items.length), top20Availability, paginationRequested: false, responseBodyLogged: false, apiKeyLogged: false, cronSecretLogged: false }, 200, { 'Cache-Control': 'no-store' })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const statusMatch = message.match(/provider status (\d+)/)
    if (env.ENTROPY_DB) await recordApiUsage(env.ENTROPY_DB, { purpose: 'diagnostic', apiRequests: 1 })
    return json({ ok: false, httpStatus: statusMatch ? Number(statusMatch[1]) : 502, requestedCount: 20, braveWebResultsCount: 0, validResultCount: 0, top10Count: 0, top20Availability: 'unavailable', paginationRequested: false, responseBodyLogged: false, apiKeyLogged: false, cronSecretLogged: false }, 502, { 'Cache-Control': 'no-store' })
  }
}
