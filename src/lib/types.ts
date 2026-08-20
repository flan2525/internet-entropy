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
  latestRunId: string | null
  observedAt: string | null
  score: number | null
  previousScore: number | null
  completedRuns: number
  analyzedPages: number
  startDate: string | null
  nextObservation: string | null
  domains: Array<{ name: string; score: number | null; pages: number; observedAt: string | null }>
}

export type OfficialQueryAudit = {
  domain: string
  query: string
  requested_count: number
  returned_count: number
  status: 'success' | 'partial' | 'failure'
  score: number | null
  missingMetrics: string[]
  error_reason: string | null
  clusters: Array<{ clusterId: string; pages: number; hostnames: string[] }>
}

export type OfficialAudit = {
  hasObservation: boolean
  runId?: string
  observedAt?: string
  score?: number | null
  analyzedPages?: number
  calculationVersion?: string
  duplicateNormalizedUrls?: number
  queries: OfficialQueryAudit[]
}
