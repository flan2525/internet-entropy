import { describe, expect, it } from 'vitest'
import { calculateObservedHealth, clampScore, harmonicMean } from '../src/lib/metrics'

describe('metric calculations', () => {
  it('clamps scores to the public 0-100 scale', () => {
    expect(clampScore(-2)).toBe(0)
    expect(clampScore(101)).toBe(100)
    expect(clampScore(64.7)).toBe(65)
  })

  it('returns null when harmonic mean has no valid values', () => {
    expect(harmonicMean([0, Number.NaN])).toBeNull()
    expect(harmonicMean([60, 80])).toBe(69)
  })

  it('reweights only the available indicators', () => {
    expect(calculateObservedHealth({ originality: 60, sourceHealth: 80 })).toBe(70)
    expect(calculateObservedHealth({ originality: 60 })).toBeNull()
  })
})
