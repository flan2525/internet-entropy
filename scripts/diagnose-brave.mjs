import { URL } from 'node:url'

const apiKey = process.env.BRAVE_SEARCH_API_KEY
if (!apiKey) throw new Error('BRAVE_SEARCH_API_KEY is not configured')

const query = 'how to improve sleep'
const requestedCount = 20
const url = new URL('https://api.search.brave.com/res/v1/web/search')
url.searchParams.set('q', query)
url.searchParams.set('count', String(requestedCount))
url.searchParams.set('country', 'us')
url.searchParams.set('search_lang', 'en')
url.searchParams.set('safesearch', 'moderate')
url.searchParams.set('text_decorations', 'false')
const response = await fetch(url, { headers: { Accept: 'application/json', 'X-Subscription-Token': apiKey } })
const payload = await response.json()
const webResults = Array.isArray(payload?.web?.results) ? payload.web.results : []
const validResults = webResults.filter((item) => item && typeof item.title === 'string' && typeof item.url === 'string')
console.log(JSON.stringify({ query, requestCount: requestedCount, httpStatus: response.status, braveWebResultsCount: webResults.length, validResultCount: validResults.length, appProviderLimit: 'max 20; no 10-item truncation', paginationNeededFor11to20: webResults.length < 20, responseBodyLogged: false, apiKeyLogged: false }, null, 2))
