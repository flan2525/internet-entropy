import type { PagesContext } from '../lib/types'
import { json } from '../lib/validation'

const empty = { hasObservation: false, latestRunId: null, runType: null, isBaseline: false, observedAt: null, score: null, previousScore: null, completedRuns: 0, analyzedPages: 0, startDate: null, nextObservation: '定期観測の設定後に表示', metricCoverage: { available: 0, total: 4, missing: ['独自性', '出典健全性', '発見多様性', '持続性'] }, domains: ['医療・健康', '災害・防災', '科学・技術', 'ニュース・時事', '製品レビュー'].map((name) => ({ name, score: null, pages: 0, observedAt: null })) }

export const onRequestGet = async ({ env }: PagesContext) => {
  if (!env.ENTROPY_DB) return json(empty, 200, { 'Cache-Control': 'public, max-age=60' })
  const latest = await env.ENTROPY_DB.prepare("SELECT r.id, r.observed_at, r.score, r.analyzed_pages, r.started_at, l.run_type FROM observation_runs r JOIN observation_run_labels l ON l.run_id = r.id AND l.run_type IN ('scheduled', 'manual_official') ORDER BY r.observed_at DESC LIMIT 1").first<{ id: string; observed_at: string; score: number | null; analyzed_pages: number; started_at: string; run_type: 'scheduled' | 'manual_official' }>()
  const count = await env.ENTROPY_DB.prepare("SELECT COUNT(*) as count, COALESCE(SUM(r.analyzed_pages), 0) as pages, MIN(r.started_at) as start_date FROM observation_runs r JOIN observation_run_labels l ON l.run_id = r.id AND l.run_type IN ('scheduled', 'manual_official') WHERE EXISTS (SELECT 1 FROM observation_queries WHERE observation_queries.run_id = r.id)").first<{ count: number; pages: number; start_date: string | null }>()
  if (!latest) return json(empty, 200, { 'Cache-Control': 'public, max-age=60' })
  const domains = await env.ENTROPY_DB.prepare('SELECT domain, score, analyzed_pages, observed_at FROM observation_domain_scores WHERE run_id = ?1 ORDER BY domain').bind(latest.id).all<{ domain: string; score: number; analyzed_pages: number; observed_at: string }>()
  const previous = await env.ENTROPY_DB.prepare("SELECT r.score FROM observation_runs r JOIN observation_run_labels l ON l.run_id = r.id AND l.run_type IN ('scheduled', 'manual_official') WHERE r.observed_at < ?1 ORDER BY r.observed_at DESC LIMIT 1").bind(latest.observed_at).first<{ score: number | null }>()
  const queryRows = await env.ENTROPY_DB.prepare('SELECT missing_metrics FROM observation_queries WHERE run_id = ?1').bind(latest.id).all<{ missing_metrics: string }>()
  const missing = [...new Set(queryRows.results.flatMap((row) => row.missing_metrics ? row.missing_metrics.split('、') : []))]
  const publicRunCount = count?.count ?? 0
  return json({ hasObservation: true, latestRunId: latest.id, runType: latest.run_type, isBaseline: latest.run_type === 'manual_official' && publicRunCount === 1, observedAt: latest.observed_at, score: latest.score, previousScore: previous?.score ?? null, completedRuns: publicRunCount, analyzedPages: count?.pages ?? 0, startDate: count?.start_date ?? latest.started_at, nextObservation: 'GitHub Actionsのscheduleにより定期実行', metricCoverage: { available: 4 - missing.length, total: 4, missing }, domains: domains.results.map((item) => ({ name: item.domain, score: item.score, pages: item.analyzed_pages, observedAt: item.observed_at })) }, 200, { 'Cache-Control': 'public, max-age=60' })
}
