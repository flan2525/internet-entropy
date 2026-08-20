import { describe, expect, it } from 'vitest'
import { analyzeResults, calculateWeightedMetricScore, canCalculatePersistence, classifyHttpStatus, classifyObservationCoverage, normalizeUrl, PERSISTENCE_REQUIREMENTS } from '../functions/lib/analysis'

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

  it('keeps persistence unavailable until both history and page metadata exist', () => {
    expect(PERSISTENCE_REQUIREMENTS.minimumPublicHistoryRuns).toBe(1)
    expect(PERSISTENCE_REQUIREMENTS.bodyHashCalculated).toBe(true)
    expect(canCalculatePersistence({ hasPreviousRun: false, hasPageFetchMetadata: true })).toBe(false)
    expect(canCalculatePersistence({ hasPreviousRun: true, hasPageFetchMetadata: false })).toBe(false)
    expect(canCalculatePersistence({ hasPreviousRun: true, hasPageFetchMetadata: true })).toBe(true)
  })

  it('separates primary Top 10 completeness from extended Top 20 coverage', () => {
    expect(classifyObservationCoverage({ requestedCount: 20, returnedCount: 10 })).toEqual({ queryObservationStatus: 'complete', top10Coverage: 'complete', extendedTop20Coverage: 'unavailable' })
    expect(classifyObservationCoverage({ requestedCount: 20, returnedCount: 15 })).toEqual({ queryObservationStatus: 'complete', top10Coverage: 'complete', extendedTop20Coverage: 'partial' })
    expect(classifyObservationCoverage({ requestedCount: 20, returnedCount: 20 })).toEqual({ queryObservationStatus: 'complete', top10Coverage: 'complete', extendedTop20Coverage: 'available' })
    expect(classifyObservationCoverage({ requestedCount: 20, returnedCount: 1 })).toEqual({ queryObservationStatus: 'partial', top10Coverage: 'partial', extendedTop20Coverage: 'unavailable' })
    expect(classifyObservationCoverage({ requestedCount: 20, returnedCount: 0, providerFailed: true })).toEqual({ queryObservationStatus: 'failed', top10Coverage: 'unavailable', extendedTop20Coverage: 'unavailable' })
  })

  it('labels live analysis quality and keeps primary assessment unevaluable without body evidence', () => {
    const items = Array.from({ length: 10 }, (_, index) => ({ title: `Result ${index + 1}`, url: `https://example.com/${index + 1}`, description: `Snippet ${index + 1}` }))
    const snippetOnly = analyzeResults('Yahoo Japan', items, 'brave', 20, new Map())
    expect(snippetOnly.qualityLevel).toBe('snippet_only')
    expect(snippetOnly.fullPagesRetrieved).toBe(0)
    expect(snippetOnly.primarySourceAssessment).toBe('not_evaluable')
    expect(snippetOnly.similarityGroupCount).toBe(0)
    const mixedEvidence = new Map(items.map((item, index) => [item.url, { fullContent: index === 0, primaryConfidence: index === 0 ? 'official_source_candidate' as const : 'unevaluable' as const }]))
    const mixed = analyzeResults('Google Gemini', items, 'brave', 20, mixedEvidence)
    expect(mixed.qualityLevel).toBe('mixed_content')
    expect(mixed.fullPagesRetrieved).toBe(1)
    const full = analyzeResults('Google Gemini', items, 'brave', 20, new Map(items.map((item) => [item.url, { fullContent: true, primaryConfidence: 'likely_primary_source' as const }])))
    expect(full.qualityLevel).toBe('full_content')
    expect(full.primarySourceAssessment).toBe('evaluable')
  })
})
