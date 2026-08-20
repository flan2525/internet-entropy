import { describe, expect, it } from 'vitest'
import panel from '../config/panels/en-us-core-v1.json'
import { buildSearchRankChanges } from '../functions/lib/analysis'

describe('English observation panel', () => {
  it('keeps a fixed 50-query panel with balanced categories', () => {
    expect(panel.panel_id).toBe('en-us-core-v1')
    expect(panel.queries).toHaveLength(50)
    expect(new Set(panel.queries.map((query) => query.id)).size).toBe(50)
    expect(new Set(panel.queries.map((query) => query.domain)).size).toBe(5)
    for (const domain of new Set(panel.queries.map((query) => query.domain))) {
      const queries = panel.queries.filter((query) => query.domain === domain)
      expect(queries).toHaveLength(10)
      expect(queries.filter((query) => query.query_type === 'evergreen')).toHaveLength(4)
      expect(queries.filter((query) => query.query_type === 'primary_source')).toHaveLength(2)
      expect(queries.filter((query) => query.query_type === 'current_affairs')).toHaveLength(2)
      expect(queries.filter((query) => query.query_type === 'rewrite_heavy')).toHaveLength(2)
    }
  })

  it('separates top-10/top-20 search departures and returned results', () => {
    const previous = [
      { queryId: 'q', query: 'q', domain: 'x', normalizedUrl: 'https://a.example', title: 'A', rank: 1 },
      { queryId: 'q', query: 'q', domain: 'x', normalizedUrl: 'https://b.example', title: 'B', rank: 12 },
    ]
    const current = [
      { queryId: 'q', query: 'q', domain: 'x', normalizedUrl: 'https://a.example', title: 'A', rank: 5 },
      { queryId: 'q', query: 'q', domain: 'x', normalizedUrl: 'https://c.example', title: 'C', rank: 15 },
    ]
    const changes = buildSearchRankChanges(previous, current, new Set(['https://c.example']))
    expect(changes.find((change) => change.normalizedUrl === 'https://a.example')?.status).toBe('rank_changed')
    expect(changes.find((change) => change.normalizedUrl === 'https://b.example')?.status).toBe('dropped_from_top_20')
    expect(changes.find((change) => change.normalizedUrl === 'https://c.example')?.status).toBe('returned_to_results')
  })
})
