import { describe, expect, it } from 'vitest'
import { analyzeResults, calculateWeightedMetricScore, classifyHttpStatus, normalizeUrl } from '../functions/lib/analysis'

describe('analysis primitives', () => {
  it('normalizes URL fragments and trailing slashes', () => {
    expect(normalizeUrl('HTTPS://Example.com/path///#section')).toBe('https://example.com/path')
  })

  it('classifies HTTP outcomes without ping semantics', () => {
    expect(classifyHttpStatus(200)).toBe('ok')
    expect(classifyHttpStatus(301)).toBe('redirect')
    expect(classifyHttpStatus(404)).toBe('client_error')
    expect(classifyHttpStatus('timeout')).toBe('timeout')
  })

  it('clusters repeated result language into information lineages', () => {
    const result = analyzeResults('生成AI', [
      { title: '生成AIの基礎と仕組み', url: 'https://one.example/a', description: '生成AIの仕組みを解説' },
      { title: '生成AIの基礎と仕組み', url: 'https://two.example/a', description: '生成AIの仕組みを解説' },
      { title: '自治体の公式資料', url: 'https://city.go.jp/a', description: '公開資料' },
    ], 'brave')
    expect(result.lineageCount).toBe(2)
    expect(result.totalResults).toBe(3)
    expect(result.primarySourceReach).toBe(1)
  })

  it('reweights available metric weights when persistence is missing', () => {
    expect(calculateWeightedMetricScore([
      { key: 'originality', value: 100 },
      { key: 'sourceHealth', value: 0 },
      { key: 'diversity', value: 100 },
      { key: 'persistence', value: null },
    ])).toBe(63)
    expect(calculateWeightedMetricScore([
      { key: 'originality', value: null },
      { key: 'sourceHealth', value: null },
      { key: 'diversity', value: null },
      { key: 'persistence', value: null },
    ])).toBeNull()
  })
})
