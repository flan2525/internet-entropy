export type MetricKey = 'originality' | 'sourceHealth' | 'diversity' | 'persistence'

export type Metric = {
  key: MetricKey
  label: string
  value: number | null
  definition: string
  sampleSize: number
  unit: string
}

export type LineageCluster = {
  id: string
  label: string
  resultCount: number
  color: string
  primarySource?: string
  confidence: '推定' | '高'
}

export type ExperimentResult = {
  query: string
  source: 'sample' | 'brave' | 'official'
  observedAt: string
  totalResults: number
  distinctDomains: number
  lineageCount: number
  primarySourceReach: number
  highSimilarityPairs: number
  unavailableCount: number
  metrics: Metric[]
  clusters: LineageCluster[]
  pages: Array<{ title: string; domain: string; clusterId: string; sourceType: string; url: string }>
  note: string
}

export type OfficialOverview = {
  hasObservation: boolean
  observedAt: string | null
  score: number | null
  previousScore: number | null
  completedRuns: number
  analyzedPages: number
  startDate: string | null
  nextObservation: string | null
  domains: Array<{ name: string; score: number | null; pages: number; observedAt: string | null }>
}
