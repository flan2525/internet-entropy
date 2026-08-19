import type { Metric, MetricKey } from './types'

export const METRIC_DEFINITIONS: Record<MetricKey, { label: string; definition: string }> = {
  originality: { label: '独自性', definition: '他ページと重複しない論点や記述の割合を推定します。' },
  sourceHealth: { label: '出典健全性', definition: '一次資料・発行主体・引用元が確認できる度合いを見ます。' },
  diversity: { label: '発見多様性', definition: '異なるドメイン、運営主体、引用元に出会える度合いを見ます。' },
  persistence: { label: '持続性', definition: 'URLの生存、移転、内容の変化を継続的に記録します。' },
}

export const clampScore = (value: number): number => Math.round(Math.max(0, Math.min(100, value)))

export const harmonicMean = (values: number[]): number | null => {
  const valid = values.filter((value) => Number.isFinite(value) && value > 0)
  if (valid.length === 0) return null
  return clampScore(valid.length / valid.reduce((sum, value) => sum + 1 / value, 0))
}

export const calculateObservedHealth = (metrics: Partial<Record<MetricKey, number | null>>): number | null => {
  const weights: Record<MetricKey, number> = { originality: 0.3, sourceHealth: 0.3, diversity: 0.2, persistence: 0.2 }
  const available = (Object.keys(weights) as MetricKey[]).filter((key) => metrics[key] !== null && metrics[key] !== undefined)
  if (available.length < 2) return null
  const totalWeight = available.reduce((sum, key) => sum + weights[key], 0)
  return clampScore(available.reduce((sum, key) => sum + (metrics[key] ?? 0) * weights[key], 0) / totalWeight)
}

export const createMetrics = (values: Partial<Record<MetricKey, number | null>>, sampleSize: number): Metric[] =>
  (Object.keys(METRIC_DEFINITIONS) as MetricKey[]).map((key) => ({
    key,
    label: METRIC_DEFINITIONS[key].label,
    definition: METRIC_DEFINITIONS[key].definition,
    value: values[key] ?? null,
    sampleSize,
    unit: '点 / 100',
  }))
