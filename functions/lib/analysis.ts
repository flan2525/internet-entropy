import type { SearchItem } from './types'

const STOP_WORDS = new Set(['です', 'ます', 'する', 'こと', 'ため', 'から', 'まで', 'について', '情報', '最新', '解説', 'まとめ'])
const COLORS = ['#42c7b5', '#e7b75b', '#5794d0', '#a08de0']

const domainOf = (raw: string) => { try { return new URL(raw).hostname.replace(/^www\./, '') } catch { return '取得不能' } }
const normalize = (value: string) => value.toLowerCase().replace(/[「」『』。、！？,.!?()（）【】]/g, ' ').replaceAll('[', ' ').replaceAll(']', ' ').replace(/\s+/g, ' ').trim()
const tokens = (value: string) => normalize(value).split(/\s+/).filter((token) => token.length > 1 && !STOP_WORDS.has(token)).slice(0, 18)
const similarity = (a: string, b: string) => { const left = new Set(tokens(a)); const right = new Set(tokens(b)); const union = new Set([...left, ...right]).size; return union ? [...left].filter((token) => right.has(token)).length / union : 0 }

export const normalizeUrl = (raw: string) => { try { const url = new URL(raw); url.hash = ''; url.hostname = url.hostname.toLowerCase(); if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, ''); return url.toString() } catch { return raw } }
export const classifyHttpStatus = (status: number | 'timeout') => status === 'timeout' ? 'timeout' : status >= 200 && status < 300 ? 'ok' : status >= 300 && status < 400 ? 'redirect' : status >= 400 && status < 500 ? 'client_error' : 'server_error'

export const makeSampleResult = (query: string) => {
  const domains = ['example-media.jp', 'news-example.jp', 'media-sample.jp', 'public-example.go.jp', 'review-sample.jp', 'journal-example.org', 'note-sample.jp']
  const titles = [`${query}の基礎と最新動向`, `${query}をめぐるニュースを整理`, `${query}について専門家が解説`, `${query}の公式資料と発表`, `${query}の利用者レビュー`]
  const clusters = ['a', 'b', 'a', 'c', 'b', 'd', 'a', 'c', 'd', 'b'].map((id, index) => ({ id, index })).reduce<Record<string, number>>((acc, item) => { acc[item.id] = (acc[item.id] ?? 0) + 1; return acc }, {})
  return {
    query, source: 'sample' as const, observedAt: new Date().toISOString(), totalResults: 10, distinctDomains: 7, lineageCount: 4, primarySourceReach: 2, highSimilarityPairs: 3, unavailableCount: 1,
    metrics: [{ key: 'originality', label: '独自性', value: 58, definition: '他ページと重複しない論点や記述の割合を推定します。', sampleSize: 10, unit: '点 / 100' }, { key: 'sourceHealth', label: '出典健全性', value: 64, definition: '一次資料・発行主体・引用元が確認できる度合いを見ます。', sampleSize: 10, unit: '点 / 100' }, { key: 'diversity', label: '発見多様性', value: 71, definition: '異なるドメイン、運営主体、引用元に出会える度合いを見ます。', sampleSize: 10, unit: '点 / 100' }, { key: 'persistence', label: '持続性', value: null, definition: 'URLの生存、移転、内容の変化を継続的に記録します。', sampleSize: 0, unit: '回数不足' }],
    clusters: Object.entries(clusters).map(([id, resultCount], index) => ({ id, label: `系統${String.fromCharCode(65 + index)}`, resultCount, color: COLORS[index], primarySource: index < 2 ? '資料（推定）' : undefined, confidence: '推定' as const })),
    pages: titles.map((title, index) => ({ title, domain: domains[index], clusterId: ['a', 'b', 'a', 'c', 'b'][index], sourceType: index === 3 ? '一次資料' : '解説記事', url: `https://${domains[index]}/${encodeURIComponent(query)}` })),
    note: '検索Providerが未設定のため、保存済み代表観測の形式で表示しています。これはライブ実測値ではありません.',
  }
}

export const analyzeResults = (query: string, items: SearchItem[], provider: 'brave' | 'sample') => {
  const limited = items.slice(0, 10)
  const groups: Array<{ items: SearchItem[]; key: string }> = []
  for (const item of limited) { const matching = groups.find((group) => similarity(`${item.title} ${item.description}`, `${group.items[0].title} ${group.items[0].description}`) >= .22); if (matching) matching.items.push(item); else groups.push({ items: [item], key: String.fromCharCode(97 + groups.length) }) }
  const metrics = { originality: Math.round(100 * (groups.length / Math.max(1, limited.length))), sourceHealth: Math.round(100 * limited.filter((item) => /\.go\.jp$|\.ac\.jp$|\.gov\.|who\.int|un\.org/.test(domainOf(item.url))).length / Math.max(1, limited.length)), diversity: Math.round(100 * new Set(limited.map((item) => domainOf(item.url))).size / Math.max(1, limited.length)), persistence: null }
  return {
    query, source: provider, observedAt: new Date().toISOString(), totalResults: limited.length, distinctDomains: new Set(limited.map((item) => domainOf(item.url))).size, lineageCount: groups.length, primarySourceReach: limited.filter((item) => /\.go\.jp$|\.ac\.jp$|\.gov\.|who\.int|un\.org/.test(domainOf(item.url))).length, highSimilarityPairs: groups.filter((group) => group.items.length > 1).reduce((sum, group) => sum + group.items.length - 1, 0), unavailableCount: 10 - limited.length,
    metrics: Object.entries(metrics).map(([key, value]) => ({ key, label: key === 'originality' ? '独自性' : key === 'sourceHealth' ? '出典健全性' : key === 'diversity' ? '発見多様性' : '持続性', value, definition: '', sampleSize: limited.length, unit: value === null ? '回数不足' : '点 / 100' })),
    clusters: groups.map((group, index) => ({ id: group.key, label: `系統${String.fromCharCode(65 + index)}`, resultCount: group.items.length, color: COLORS[index % COLORS.length], primarySource: group.items[0].title, confidence: '推定' as const })),
    pages: limited.map((item, index) => ({ title: item.title, domain: domainOf(item.url), clusterId: groups.find((group) => group.items.includes(item))?.key ?? 'a', sourceType: index === 0 ? '検索結果' : '関連ページ', url: normalizeUrl(item.url) })),
    note: '検索結果のタイトル・説明・URLから再現可能な規則で情報系統を推定しています。本文全文は保存しません。',
  }
}
