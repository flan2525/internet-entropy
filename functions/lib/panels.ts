import panelJson from '../../config/panels/en-us-core-v1.json'

export type QueryType = 'evergreen' | 'primary_source' | 'current_affairs' | 'rewrite_heavy'
export type PanelQuery = {
  id: string
  query: string
  domain: string
  query_type: QueryType
  rationale: string
  active_from: string
  inactive_at?: string
}

export type ObservationPanel = {
  panel_id: string
  version: string
  search_lang: string
  country: string
  ui_lang: string
  safe_search: 'moderate'
  result_count: number
  methodology_version: string
  selection_reason: string
  queries: PanelQuery[]
}

export const EN_US_PANEL = panelJson as ObservationPanel
export const PUBLIC_PANEL_ID = EN_US_PANEL.panel_id
export const LEGACY_PANEL_ID = 'legacy-ja'
export const PUBLIC_RUN_TYPES = ['scheduled', 'manual_official'] as const
export type PublicRunType = typeof PUBLIC_RUN_TYPES[number]
export const MAX_MONTHLY_BRAVE_REQUESTS = 1000
export const LIVE_MONTHLY_RESERVE = 300
export const HTTP_VERIFICATION_BATCH_SIZE = 100

export const panelById = (panelId: string) => panelId === PUBLIC_PANEL_ID ? EN_US_PANEL : null
