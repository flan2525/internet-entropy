import type { PagesContext } from '../../lib/types'
import { json } from '../../lib/validation'

const MAX_SNAPSHOT_BYTES = 160_000
const EXPIRY_DAYS = 30

export const onRequestPost = async ({ request, env }: PagesContext) => {
  if (!env.ENTROPY_DB) return json({ error: 'sharing is not configured' }, 503)
  const ip = request.headers.get('CF-Connecting-IP') ?? 'anonymous'
  try {
    const key = new Request(`https://entropy-share-rate.invalid/${ip}`)
    if (await caches.default.match(key)) return json({ error: 'share rate limit reached' }, 429, { 'Cache-Control': 'no-store' })
    await caches.default.put(key, new Response('1', { headers: { 'Cache-Control': 'max-age=60' } }))
  } catch { /* Cache API is optional in local dev. */ }
  let body: { result?: unknown; country?: string; searchLang?: string } = {}
  try { body = await request.json() as typeof body } catch { return json({ error: 'invalid request' }, 400) }
  if (!body.result || typeof body.result !== 'object') return json({ error: 'result is required' }, 400)
  const result = body.result as Record<string, unknown>
  if (typeof result.query !== 'string' || result.query.length < 2 || typeof result.totalResults !== 'number' || result.totalResults < 1) return json({ error: 'a measured result is required' }, 400)
  const resultJson = JSON.stringify(result)
  if (new TextEncoder().encode(resultJson).byteLength > MAX_SNAPSHOT_BYTES) return json({ error: 'result is too large to share' }, 413)
  await env.ENTROPY_DB.prepare("DELETE FROM live_share_snapshots WHERE expires_at <= datetime('now')").run()
  const resultId = crypto.randomUUID()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + EXPIRY_DAYS * 86400000).toISOString()
  await env.ENTROPY_DB.prepare('INSERT INTO live_share_snapshots (result_id, query, country, search_lang, result_json, methodology_version, observed_at, created_at, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)').bind(resultId, result.query, body.country ?? 'US', body.searchLang ?? 'en', resultJson, 'live-2', typeof result.observedAt === 'string' ? result.observedAt : now.toISOString(), now.toISOString(), expiresAt).run()
  return json({ resultId, expiresAt }, 201, { 'Cache-Control': 'no-store' })
}
