import { recordApiUsage } from '../../lib/budget'
import { EN_US_PANEL, HTTP_VERIFICATION_BATCH_SIZE, PUBLIC_PANEL_ID } from '../../lib/panels'
import { verifyUrl } from '../../lib/url-verification'
import type { PagesContext } from '../../lib/types'
import { json } from '../../lib/validation'

type QueueRow = { id: number; normalized_url: string; last_seen_url: string; domain: string; query_id: string; query: string; first_observed_at: string; consecutive_failures: number; web_status: string }
const batch = async (db: NonNullable<PagesContext['env']['ENTROPY_DB']>, statements: ReturnType<typeof db.prepare>[]) => { for (let index = 0; index < statements.length; index += 50) await db.batch(statements.slice(index, index + 50)) }
const failureState = (state: string) => ['temporarily_unavailable', 'persistent_unavailable', 'disappeared'].includes(state)
const nextVerifyAt = (state: string, now: string) => failureState(state) ? new Date(new Date(now).getTime() + (state === 'disappeared' ? 30 : 7) * 86400000).toISOString() : new Date(new Date(now).getTime() + 30 * 86400000).toISOString()

export const onRequestPost = async ({ request, env }: PagesContext) => {
  if (!env.OBSERVATION_CRON_SECRET || request.headers.get('Authorization') !== `Bearer ${env.OBSERVATION_CRON_SECRET}`) return json({ error: 'not found' }, 404)
  if (!env.ENTROPY_DB) return json({ error: 'database is not configured' }, 503)
  const observedAt = new Date().toISOString()
  const limit = Math.min(HTTP_VERIFICATION_BATCH_SIZE, Math.max(1, Number(new URL(request.url).searchParams.get('limit') ?? HTTP_VERIFICATION_BATCH_SIZE)))
  const runId = crypto.randomUUID()
  await env.ENTROPY_DB.prepare('INSERT INTO observation_runs (id, started_at, observed_at, score, analyzed_pages, calculation_version) VALUES (?1, ?2, ?3, NULL, 0, ?4)').bind(runId, observedAt, observedAt, EN_US_PANEL.methodology_version).run()
  await env.ENTROPY_DB.prepare('INSERT INTO observation_run_types (run_id, run_type, panel_id, classified_at) VALUES (?1, \'diagnostic\', ?2, ?3)').bind(runId, PUBLIC_PANEL_ID, observedAt).run()
  await env.ENTROPY_DB.prepare('INSERT INTO observation_run_context (run_id, panel_id, panel_version, methodology_version, search_lang, country, ui_lang, safe_search, result_count, run_status, api_requests, created_at, run_key) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, \'completed\', 0, ?10, ?11)').bind(runId, PUBLIC_PANEL_ID, EN_US_PANEL.version, EN_US_PANEL.methodology_version, EN_US_PANEL.search_lang, EN_US_PANEL.country, EN_US_PANEL.ui_lang, EN_US_PANEL.safe_search, EN_US_PANEL.result_count, observedAt, `verify-${runId}`).run()
  const due = await env.ENTROPY_DB.prepare('SELECT id, normalized_url, last_seen_url, domain, query_id, query, first_observed_at, consecutive_failures, web_status FROM url_verification_queue WHERE panel_id = ?1 AND next_verify_at <= ?2 ORDER BY priority DESC, next_verify_at ASC LIMIT ?3').bind(PUBLIC_PANEL_ID, observedAt, limit).all<QueueRow>()
  if (!due.results.length) return json({ ok: true, runId, panelId: PUBLIC_PANEL_ID, checked: 0, remaining: 0, states: {} }, 200)
  const checks: Array<{ queue: QueueRow; result: Awaited<ReturnType<typeof verifyUrl>>; searchStatus: string }> = []
  for (let index = 0; index < due.results.length; index += 10) {
    const chunk = due.results.slice(index, index + 10)
    const results = await Promise.all(chunk.map(async (queue) => {
      const previous = await env.ENTROPY_DB!.prepare('SELECT title_hash, body_hash FROM url_verification_history WHERE panel_id = ?1 AND normalized_url = ?2 ORDER BY observed_at DESC LIMIT 1').bind(PUBLIC_PANEL_ID, queue.normalized_url).first<{ title_hash: string | null; body_hash: string | null }>()
      const result = await verifyUrl({ url: queue.last_seen_url, previousStatus: queue.web_status, previousFailures: queue.consecutive_failures, previousTitleHash: previous?.title_hash, previousBodyHash: previous?.body_hash })
      const search = await env.ENTROPY_DB!.prepare('SELECT search_status FROM search_rank_history WHERE panel_id = ?1 AND normalized_url = ?2 ORDER BY observed_at DESC LIMIT 1').bind(PUBLIC_PANEL_ID, queue.normalized_url).first<{ search_status: string }>()
      return { queue, result, searchStatus: search?.search_status ?? 'still_ranked' }
    }))
    checks.push(...results)
  }
  await batch(env.ENTROPY_DB, checks.map(({ queue, result }) => env.ENTROPY_DB!.prepare('INSERT INTO url_verification_history (run_id, panel_id, normalized_url, requested_method, final_url, http_status, redirect_count, content_type, page_title, title_hash, body_hash, result_state, error_reason, robots_status, retry_count, observed_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)').bind(runId, PUBLIC_PANEL_ID, queue.normalized_url, result.requestedMethod, result.finalUrl, result.httpStatus, result.redirectCount, result.contentType, result.title, result.titleHash, result.bodyHash, result.state, result.errorReason, result.robotsStatus, result.retryCount, observedAt)))
  await batch(env.ENTROPY_DB, checks.map(({ queue, result }) => env.ENTROPY_DB!.prepare('UPDATE url_verification_queue SET consecutive_failures = ?1, web_status = ?2, last_http_status = ?3, last_final_url = ?4, last_verified_at = ?5, last_error_reason = ?6, robots_status = ?7, next_verify_at = ?8, priority = ?9 WHERE id = ?10').bind(failureState(result.state) ? queue.consecutive_failures + 1 : 0, result.state, result.httpStatus, result.finalUrl, observedAt, result.errorReason, result.robotsStatus, nextVerifyAt(result.state, observedAt), result.state === 'disappeared' ? 1 : 2, queue.id)))
  await batch(env.ENTROPY_DB, checks.filter(({ result }) => ['disappeared', 'replaced_candidate', 'moved'].includes(result.state)).map(({ queue, result, searchStatus }) => env.ENTROPY_DB!.prepare('INSERT INTO disappearance_events (panel_id, run_id, normalized_url, title, domain, query_id, query, previous_rank, last_seen_at, search_status, web_status, redirect_url, confidence, evidence, first_observed_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, (SELECT previous_rank FROM search_rank_history WHERE panel_id = ?1 AND normalized_url = ?3 ORDER BY observed_at DESC LIMIT 1), ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?8)').bind(PUBLIC_PANEL_ID, runId, queue.normalized_url, result.title, queue.domain, queue.query_id, queue.query, observedAt, searchStatus, result.state, result.finalUrl === queue.last_seen_url ? null : result.finalUrl, result.state === 'disappeared' ? 'high' : 'medium', result.state === 'disappeared' ? 'Repeated direct HTTP failure after prior failure.' : result.state === 'replaced_candidate' ? 'HTTP page remained reachable but title or body hash changed.' : 'Direct HTTP verification observed a move or redirect.')))
  const states = checks.reduce<Record<string, number>>((counts, check) => { counts[check.result.state] = (counts[check.result.state] ?? 0) + 1; return counts }, {})
  await env.ENTROPY_DB.prepare('UPDATE observation_run_context SET http_checks = ?1, web_disappearance_candidates = ?2, confirmed_disappeared = ?3 WHERE run_id = ?4').bind(checks.length, states.replaced_candidate ?? 0, states.disappeared ?? 0, runId).run()
  await recordApiUsage(env.ENTROPY_DB, { panelId: PUBLIC_PANEL_ID, purpose: 'diagnostic', runId, apiRequests: 0 })
  const remaining = await env.ENTROPY_DB.prepare('SELECT COUNT(*) AS count FROM url_verification_queue WHERE panel_id = ?1 AND next_verify_at <= ?2').bind(PUBLIC_PANEL_ID, new Date().toISOString()).first<{ count: number }>()
  return json({ ok: true, runId, panelId: PUBLIC_PANEL_ID, checked: checks.length, remaining: Number(remaining?.count ?? 0), states }, 200)
}
