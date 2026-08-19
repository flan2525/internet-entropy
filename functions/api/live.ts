import { analyzeResults, makeSampleResult } from '../lib/analysis'
import { searchWeb, ProviderUnavailable } from '../lib/provider'
import type { PagesContext } from '../lib/types'
import { json } from '../lib/validation'

const limited = async (request: Request, query: string) => {
  try {
    const cache = caches.default
    const key = new Request(`https://entropy-rate.invalid/${encodeURIComponent(`${request.headers.get('CF-Connecting-IP') ?? 'anonymous'}:${query}`)}`)
    if (await cache.match(key)) return false
    await cache.put(key, new Response('1', { headers: { 'Cache-Control': 'max-age=86400' } }))
  } catch { /* Cache API is optional in local dev. */ }
  return true
}

export const onRequestGet = async ({ request, env }: PagesContext) => {
  const query = new URL(request.url).searchParams.get('q')?.trim().replace(/\s+/g, ' ')
  if (!query || query.length < 2 || query.length > 60 || /https?:\/\//i.test(query) || /@/.test(query)) return json({ error: '検索語を2〜60文字で入力して。URLや個人情報は入力しないで。' }, 400)
  if (!(await limited(request, query))) return json({ error: '匿名利用の上限に達した。保存済み代表観測を確認して。' }, 429, { 'Cache-Control': 'no-store' })

  const cached = env.ENTROPY_DB ? await env.ENTROPY_DB.prepare('SELECT result_json FROM live_runs WHERE query = ?1 AND created_at > datetime(\'now\', \'-30 minutes\') ORDER BY created_at DESC LIMIT 1').bind(query).first<{ result_json: string }>() : null
  if (cached?.result_json) return json(JSON.parse(cached.result_json), 200, { 'Cache-Control': 'public, max-age=300' })

  let result
  try {
    const response = await searchWeb(query, env)
    result = analyzeResults(query, response.items, response.provider)
  } catch (error) {
    if (!(error instanceof ProviderUnavailable)) return json({ error: '観測処理に失敗した。時間を置いて再試行して。' }, 502)
    result = makeSampleResult(query)
  }
  if (env.ENTROPY_DB) await env.ENTROPY_DB.prepare('INSERT INTO live_runs (query, source, result_json, created_at) VALUES (?1, ?2, ?3, datetime(\'now\'))').bind(query, result.source, JSON.stringify(result)).run()
  return json(result, 200, { 'Cache-Control': 'public, max-age=300' })
}
