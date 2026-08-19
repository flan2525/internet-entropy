import { analyzeResults } from '../../lib/analysis'
import { searchWeb } from '../../lib/provider'
import type { PagesContext } from '../../lib/types'
import { json } from '../../lib/validation'

const queries = [
  { domain: '医療・健康', query: '睡眠 改善 方法' }, { domain: '医療・健康', query: '花粉症 対策' },
  { domain: '災害・防災', query: '防災 備蓄' }, { domain: '災害・防災', query: '南海トラフ 地震' },
  { domain: '科学・技術', query: '生成AI 仕組み' }, { domain: '科学・技術', query: '再生可能エネルギー' },
  { domain: 'ニュース・時事', query: '選挙 仕組み' }, { domain: 'ニュース・時事', query: '物価 上昇 理由' },
  { domain: '製品レビュー', query: 'ノートパソコン 選び方' }, { domain: '製品レビュー', query: 'ワイヤレスイヤホン 比較' },
]

export const onRequestPost = async ({ request, env }: PagesContext) => {
  if (!env.OBSERVATION_CRON_SECRET || request.headers.get('Authorization') !== `Bearer ${env.OBSERVATION_CRON_SECRET}`) return json({ error: 'not found' }, 404)
  if (!env.ENTROPY_DB) return json({ error: 'database is not configured' }, 503)
  const started = new Date().toISOString()
  const runId = crypto.randomUUID()
  const scores: Record<string, number[]> = {}
  let analyzedPages = 0
  for (const item of queries) {
    try {
      const response = await searchWeb(item.query, env)
      const result = analyzeResults(item.query, response.items, response.provider)
      const values = result.metrics.map((metric) => metric.value).filter((value): value is number => value !== null)
      const score = values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null
      if (score !== null) scores[item.domain] = [...(scores[item.domain] ?? []), score]
      analyzedPages += result.totalResults
    } catch { /* A single query failure must not abort the fixed observation. */ }
  }
  const domainScores = Object.entries(scores).map(([domain, values]) => ({ domain, score: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length), pages: values.length * 10 }))
  const score = domainScores.length ? Math.round(domainScores.reduce((sum, item) => sum + item.score, 0) / domainScores.length) : null
  await env.ENTROPY_DB.prepare('INSERT INTO observation_runs (id, started_at, observed_at, score, analyzed_pages, calculation_version) VALUES (?1, ?2, datetime(\'now\'), ?3, ?4, ?5)').bind(runId, started, score, analyzedPages, 'mvp-1').run()
  await env.ENTROPY_DB.batch(domainScores.map((item) => env.ENTROPY_DB!.prepare('INSERT INTO observation_domain_scores (run_id, domain, score, analyzed_pages, observed_at) VALUES (?1, ?2, ?3, ?4, datetime(\'now\'))').bind(runId, item.domain, item.score, item.pages)))
  return json({ ok: true, runId, score, analyzedPages, domains: domainScores })
}
