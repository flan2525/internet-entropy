export type MetricKey = 'originality' | 'sourceHealth' | 'diversity' | 'persistence'
export type ObservationRunType = 'scheduled' | 'manual_official' | 'verification' | 'diagnostic' | 'legacy'
export type Locale = 'en' | 'zh-CN' | 'ja' | 'de' | 'ru'

export type Metric = { key: MetricKey; label: string; value: number | null; definition: string; sampleSize: number; unit: string }
export type LineageCluster = { id: string; label: string; resultCount: number; color: string; primarySource?: string; confidence: 'estimated' | 'high' }
export type ResultWindow = { resultCount: number; distinctDomains: number; lineageCount: number; primarySourceReach: number; highSimilarityPairs: number; score: number | null; metrics: Record<string, number | null> }
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
  top10: ResultWindow | null
  top20: ResultWindow | null
  clusters: LineageCluster[]
  pages: Array<{ title: string; domain: string; clusterId: string; sourceType: string; url: string }>
  note: string
}

export type DisappearanceEvent = { id: number; normalized_url: string; title: string; domain: string; query: string; previous_rank: number | null; last_seen_at: string; updated_at?: string; search_status: string; web_status: string; redirect_url: string | null; confidence: string; evidence: string; first_observed_at: string }
export type MonitorTimeline = { runId: string; observedAt: string; trackedUrls: number | null; searchDepartures: number | null; aliveButNoLongerRanked: number | null; redirected: number | null; temporarilyUnavailable: number | null; confirmedDisappeared: number | null }
export type DisappearanceMonitor = { hasHistory: boolean; trackingUrls: number | null; stillRanked: number | null; droppedFromTop10: number | null; droppedFromTop20: number | null; aliveButNoLongerRanked: number | null; redirectedOrMoved: number | null; temporarilyUnavailable: number | null; confirmedDisappeared: number | null; replacementCandidates: number | null; unverifiable: number | null; events: DisappearanceEvent[]; timeline: MonitorTimeline[] }
export type OfficialOverview = {
  hasObservation: boolean
  panelId: string
  panelVersion: string | null
  methodologyVersion: string
  searchLang: string
  country: string
  resultCount: number
  latestRunId: string | null
  runType: Exclude<ObservationRunType, 'verification' | 'diagnostic' | 'legacy'> | null
  isBaseline: boolean
  observedAt: string | null
  score: number | null
  top20Score: number | null
  previousScore: number | null
  completedRuns: number
  analyzedPages: number
  startDate: string | null
  nextObservation: string | null
  metricCoverage: { available: number; total: number; missing: string[] }
  queriesObserved: number
  resultsCollected: number
  uniqueNormalizedUrls: number
  duplicateNormalizedUrls: number
  top20Available: number
  statusCounts: { success: number; partial: number; failure: number }
  domains: Array<{ name: string; score: number | null; top20Score: number | null; pages: number; observedAt: string | null }>
  monitor: DisappearanceMonitor
}
export type OfficialQueryAudit = {
  domain: string; query: string; query_id?: string | null; query_type?: string | null; query_rationale?: string | null; requested_count: number; returned_count: number; status: 'success' | 'partial' | 'failure'; score: number | null; top20_score: number | null; metrics: Record<string, number | null>; top10Metrics: Record<string, number | null>; top20Metrics: Record<string, number | null>; missingMetrics: string[]; error_reason: string | null; clusters: Array<{ clusterId: string; pages: number; hostnames: string[] }>
}
export type OfficialAudit = { hasObservation: boolean; panelId?: string; runId?: string; runType?: string; observedAt?: string; score?: number | null; top20Score?: number | null; analyzedPages?: number; calculationVersion?: string; methodologyVersion?: string; queriesObserved?: number; resultsCollected?: number; uniqueNormalizedUrls?: number; duplicateNormalizedUrls?: number; top20Available?: number; statusCounts?: { success: number; partial: number; failure: number }; queries: OfficialQueryAudit[] }
