import type { PagesContext } from '../lib/types'
import { json } from '../lib/validation'

const empty = { hasObservation: false, latestRunId: null, observedAt: null, score: null, previousScore: null, completedRuns: 0, analyzedPages: 0, startDate: null, nextObservation: '定期観測の設定後に表示', domains: ['医療・健康', '災害・防災', '科学・技術', 'ニュース・時事', '製品レビュー'].map((name) => ({ name, score: null, pages: 0, observedAt: null })) }

export const onRequestGet = async ({ env }: PagesContext) => {
  if (!env.ENTROPY_DB) return json(empty, 200, { 'Cache-Control': 'public, max-age=60' })
  const latest = await env.ENTROPY_DB.prepare('SELECT observed_at, score, analyzed_pages, started_at FROM observation_runs ORDER BY observed_at DESC LIMIT 1').first<{ observed_at: string; score: number; analyzed_pages: number; started_at: string }>()
  const count = await env.ENTROPY_DB.prepare('SELECT COUNT(*) as count, COALESCE(SUM(analyzed_pages), 0) as pages, MIN(started_at) as start_date FROM observation_runs').first<{ count: number; pages: number; start_date: string | null }>()
  const domains = await env.ENTROPY_DB.prepare('SELECT domain, score, analyzed_pages, observed_at FROM observation_domain_scores ORDER BY domain').all<{ domain: string; score: number; analyzed_pages: number; observed_at: string }>()
  if (!latest) return json(empty, 200, { 'Cache-Control': 'public, max-age=60' })
  const previous = await env.ENTROPY_DB.prepare('SELECT score FROM observation_runs ORDER BY observed_at DESC LIMIT 1 OFFSET 1').first<{ score: number }>()
  const latestRun = await env.ENTROPY_DB.prepare('SELECT id FROM observation_runs ORDER BY observed_at DESC LIMIT 1').first<{ id: string }>()
  return json({ hasObservation: true, latestRunId: latestRun?.id ?? null, observedAt: latest.observed_at, score: latest.score, previousScore: previous?.score ?? null, completedRuns: count?.count ?? 0, analyzedPages: count?.pages ?? 0, startDate: count?.start_date ?? latest.started_at, nextObservation: 'GitHub Actionsのscheduleにより定期実行', domains: domains.results.map((item) => ({ name: item.domain, score: item.score, pages: item.analyzed_pages, observedAt: item.observed_at })) }, 200, { 'Cache-Control': 'public, max-age=60' })
}
