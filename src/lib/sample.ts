import type { ExperimentResult, OfficialOverview } from './types'

export const sampleExperiment: ExperimentResult = {
  query: '生成AI',
  source: 'sample',
  observedAt: '2026-08-19T09:00:00+09:00',
  totalResults: 10,
  distinctDomains: 7,
  lineageCount: 4,
  primarySourceReach: 2,
  highSimilarityPairs: 3,
  unavailableCount: 1,
  metrics: [
    { key: 'originality', label: '独自性', value: 58, definition: '他ページと重複しない論点や記述の割合を推定します。', sampleSize: 10, unit: '点 / 100' },
    { key: 'sourceHealth', label: '出典健全性', value: 64, definition: '一次資料・発行主体・引用元が確認できる度合いを見ます。', sampleSize: 10, unit: '点 / 100' },
    { key: 'diversity', label: '発見多様性', value: 71, definition: '異なるドメイン、運営主体、引用元に出会える度合いを見ます。', sampleSize: 10, unit: '点 / 100' },
    { key: 'persistence', label: '持続性', value: null, definition: 'URLの生存、移転、内容の変化を継続的に記録します。', sampleSize: 0, unit: '回数不足' },
  ],
  clusters: [
    { id: 'a', label: '系統A', resultCount: 3, color: '#42c7b5', primarySource: '公的資料（推定）', confidence: '推定' },
    { id: 'b', label: '系統B', resultCount: 3, color: '#e7b75b', primarySource: '発表資料（推定）', confidence: '推定' },
    { id: 'c', label: '系統C', resultCount: 2, color: '#5794d0', confidence: '推定' },
    { id: 'd', label: '系統D', resultCount: 2, color: '#a08de0', confidence: '推定' },
  ],
  pages: [
    { title: '生成AIとは？基礎から最新動向まで', domain: 'example-media.jp', clusterId: 'a', sourceType: '解説記事', url: 'https://example-media.jp/ai' },
    { title: '生成AIの最新動向をわかりやすく解説', domain: 'news-example.jp', clusterId: 'b', sourceType: '報道', url: 'https://news-example.jp/generative-ai' },
    { title: '生成AIの基礎知識と活用例', domain: 'media-sample.jp', clusterId: 'a', sourceType: '解説記事', url: 'https://media-sample.jp/genai' },
  ],
  note: '保存済み代表観測のサンプルです。公式定点観測の時系列には混ぜません。',
}

export const emptyOfficialOverview: OfficialOverview = {
  hasObservation: false,
  latestRunId: null,
  runType: null,
  isBaseline: false,
  observedAt: null,
  score: null,
  previousScore: null,
  completedRuns: 0,
  analyzedPages: 0,
  startDate: null,
  nextObservation: '定期観測の設定後に表示',
  metricCoverage: { available: 0, total: 4, missing: ['独自性', '出典健全性', '発見多様性', '持続性'] },
  domains: [
    { name: '医療・健康', score: null, pages: 0, observedAt: null },
    { name: '災害・防災', score: null, pages: 0, observedAt: null },
    { name: '科学・技術', score: null, pages: 0, observedAt: null },
    { name: 'ニュース・時事', score: null, pages: 0, observedAt: null },
    { name: '製品レビュー', score: null, pages: 0, observedAt: null },
  ],
}
