import type { PagesContext } from '../../../lib/types'
import { json } from '../../../lib/validation'

export const onRequestGet = async ({ env, params }: PagesContext) => {
  if (!env.ENTROPY_DB) return json({ error: 'sharing is not configured' }, 503, { 'X-Robots-Tag': 'noindex, nofollow' })
  const resultId = params.resultId
  if (!resultId || !/^[0-9a-f-]{36}$/i.test(resultId)) return json({ error: 'not found' }, 404, { 'X-Robots-Tag': 'noindex, nofollow' })
  const row = await env.ENTROPY_DB.prepare('SELECT result_id, result_json, expires_at, methodology_version, observed_at FROM live_share_snapshots WHERE result_id = ?1 LIMIT 1').bind(resultId).first<{ result_id: string; result_json: string; expires_at: string; methodology_version: string; observed_at: string }>()
  if (!row) return json({ error: 'not found' }, 404, { 'X-Robots-Tag': 'noindex, nofollow' })
  if (Date.parse(row.expires_at) <= Date.now()) return json({ error: 'expired', expired: true, expiresAt: row.expires_at }, 410, { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' })
  let result: unknown
  try { result = JSON.parse(row.result_json) } catch { return json({ error: 'not found' }, 404, { 'X-Robots-Tag': 'noindex, nofollow' }) }
  if (result && typeof result === 'object' && 'totalResults' in result && typeof result.totalResults === 'number' && (result.totalResults > 10 || (typeof result.searchResultsRetrieved === 'number' && result.searchResultsRetrieved > 10))) return json({ error: 'snapshot predates the Top 10 live-analysis policy' }, 410, { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' })
  return json({ resultId: row.result_id, result, expiresAt: row.expires_at, methodologyVersion: row.methodology_version, observedAt: row.observed_at, shared: true }, 200, { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'public, max-age=300' })
}
