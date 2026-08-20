import { LIVE_MONTHLY_RESERVE, MAX_MONTHLY_BRAVE_REQUESTS } from './panels'
import type { D1DatabaseLike } from './types'

export const currentMonth = (now = new Date()) => now.toISOString().slice(0, 7)

export const getMonthlyUsage = async (db: D1DatabaseLike, month = currentMonth()) => {
  const row = await db.prepare('SELECT COALESCE(SUM(api_requests), 0) AS requests, COALESCE(SUM(cache_hits), 0) AS cache_hits FROM api_usage_ledger WHERE period_month = ?1').bind(month).first<{ requests: number; cache_hits: number }>()
  return { requests: Number(row?.requests ?? 0), cacheHits: Number(row?.cache_hits ?? 0), month }
}

export const canSpendBrave = async (db: D1DatabaseLike, requested: number, purpose: 'official' | 'live' | 'retry' | 'diagnostic') => {
  const usage = await getMonthlyUsage(db)
  const limit = purpose === 'live' ? MAX_MONTHLY_BRAVE_REQUESTS - LIVE_MONTHLY_RESERVE : MAX_MONTHLY_BRAVE_REQUESTS
  return { allowed: usage.requests + requested <= limit, usage, limit }
}

export const recordApiUsage = async (db: D1DatabaseLike, input: { panelId?: string; purpose: 'official' | 'live' | 'retry' | 'diagnostic'; runId?: string; apiRequests?: number; cacheHits?: number }) => {
  await db.prepare('INSERT INTO api_usage_ledger (period_month, panel_id, purpose, run_id, api_requests, cache_hits, recorded_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)').bind(currentMonth(), input.panelId ?? null, input.purpose, input.runId ?? null, input.apiRequests ?? 0, input.cacheHits ?? 0, new Date().toISOString()).run()
}

export const recordLiveUsage = async (db: D1DatabaseLike, input: { started: number; completed: number; failed: number; cacheHits: number; apiRequests: number; shared: number; language: string }) => {
  const month = currentMonth()
  const existing = await db.prepare('SELECT language_usage_json FROM live_usage_aggregate WHERE period_month = ?1').bind(month).first<{ language_usage_json: string }>()
  const languages = existing?.language_usage_json ? JSON.parse(existing.language_usage_json) as Record<string, number> : {}
  languages[input.language] = (languages[input.language] ?? 0) + input.started
  await db.prepare(`INSERT INTO live_usage_aggregate (period_month, started_count, completed_count, failure_count, cache_hit_count, api_request_count, share_count, language_usage_json, updated_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
    ON CONFLICT(period_month) DO UPDATE SET started_count = started_count + excluded.started_count, completed_count = completed_count + excluded.completed_count, failure_count = failure_count + excluded.failure_count, cache_hit_count = cache_hit_count + excluded.cache_hit_count, api_request_count = api_request_count + excluded.api_request_count, share_count = share_count + excluded.share_count, language_usage_json = excluded.language_usage_json, updated_at = excluded.updated_at`).bind(month, input.started, input.completed, input.failed, input.cacheHits, input.apiRequests, input.shared, JSON.stringify(languages), new Date().toISOString()).run()
}
