import type { PagesContext } from '../../lib/types'
import { json } from '../../lib/validation'

export const onRequestGet = async ({ env }: PagesContext) => {
  if (!env.ENTROPY_DB) return json({ hasObservation: false, queries: [] }, 200, { 'Cache-Control': 'public, max-age=60' })
  const run = await env.ENTROPY_DB.prepare('SELECT id, observed_at, score, analyzed_pages, calculation_version FROM observation_runs ORDER BY observed_at DESC LIMIT 1').first<{ id: string; observed_at: string; score: number | null; analyzed_pages: number; calculation_version: string }>()
  if (!run) return json({ hasObservation: false, queries: [] }, 200, { 'Cache-Control': 'public, max-age=60' })
  const queries = await env.ENTROPY_DB.prepare('SELECT domain, query, requested_count, returned_count, status, score, metrics_json, missing_metrics, error_reason FROM observation_queries WHERE run_id = ?1 ORDER BY id').bind(run.id).all<{ domain: string; query: string; requested_count: number; returned_count: number; status: string; score: number | null; metrics_json: string; missing_metrics: string; error_reason: string | null }>()
  const pages = await env.ENTROPY_DB.prepare('SELECT query, cluster_id, hostname FROM observation_pages WHERE run_id = ?1 ORDER BY query, rank').bind(run.id).all<{ query: string; cluster_id: string | null; hostname: string }>()
  const clusters = new Map<string, Map<string, Set<string>>>()
  for (const page of pages.results) { if (!clusters.has(page.query)) clusters.set(page.query, new Map()); const byCluster = clusters.get(page.query)!; const cluster = page.cluster_id ?? '未分類'; if (!byCluster.has(cluster)) byCluster.set(cluster, new Set()); byCluster.get(cluster)!.add(page.hostname) }
  return json({ hasObservation: true, runId: run.id, observedAt: run.observed_at, score: run.score, analyzedPages: run.analyzed_pages, calculationVersion: run.calculation_version, duplicateNormalizedUrls: (await env.ENTROPY_DB.prepare('SELECT COUNT(*) as count FROM (SELECT normalized_url FROM observation_pages WHERE run_id = ?1 GROUP BY normalized_url HAVING COUNT(*) > 1)').bind(run.id).first<{ count: number }>())?.count ?? 0, queries: queries.results.map((item) => ({ ...item, metrics: JSON.parse(item.metrics_json), missingMetrics: item.missing_metrics ? item.missing_metrics.split('、') : [], clusters: [...(clusters.get(item.query)?.entries() ?? [])].map(([clusterId, hosts]) => ({ clusterId, pages: hosts.size, hostnames: [...hosts] })) })) }, 200, { 'Cache-Control': 'public, max-age=60' })
}
