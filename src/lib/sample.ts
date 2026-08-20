import type { ExperimentResult, OfficialOverview } from './types'

export const emptyExperiment = (query = ''): ExperimentResult => ({ query, source: 'sample', observedAt: new Date().toISOString(), totalResults: 0, distinctDomains: 0, lineageCount: 0, primarySourceReach: 0, highSimilarityPairs: 0, unavailableCount: 0, metrics: [], top10: null, top20: null, clusters: [], pages: [], note: 'No measured result is available yet.' })
export const sampleExperiment = emptyExperiment()

export const emptyOfficialOverview: OfficialOverview = {
  hasObservation: false, panelId: 'en-us-core-v1', panelVersion: null, methodologyVersion: 'en-core-1', searchLang: 'en', country: 'US', resultCount: 20, latestRunId: null, runType: null, isBaseline: false, observedAt: null, score: null, top20Score: null, previousScore: null, completedRuns: 0, analyzedPages: 0, startDate: null, nextObservation: 'Weekly GitHub Actions schedule', metricCoverage: { available: 0, total: 4, missing: ['Persistence'] }, domains: ['Health & Medicine', 'Disaster & Preparedness', 'Science & Technology', 'News & Public Affairs', 'Product Research'].map((name) => ({ name, score: null, top20Score: null, pages: 0, observedAt: null })), monitor: { hasHistory: false, trackingUrls: null, stillRanked: null, droppedFromTop10: null, droppedFromTop20: null, aliveButNoLongerRanked: null, redirectedOrMoved: null, temporarilyUnavailable: null, confirmedDisappeared: null, replacementCandidates: null, unverifiable: null, events: [], timeline: [] },
}
