PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS observation_panels (
  panel_id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  search_lang TEXT NOT NULL,
  country TEXT NOT NULL,
  ui_lang TEXT NOT NULL,
  safe_search TEXT NOT NULL,
  result_count INTEGER NOT NULL,
  methodology_version TEXT NOT NULL,
  selection_reason TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS observation_query_registry (
  query_id TEXT PRIMARY KEY,
  panel_id TEXT NOT NULL REFERENCES observation_panels(panel_id),
  version TEXT NOT NULL,
  domain TEXT NOT NULL,
  query TEXT NOT NULL,
  query_type TEXT NOT NULL,
  rationale TEXT NOT NULL,
  active_from TEXT NOT NULL,
  inactive_at TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS observation_run_types (
  run_id TEXT PRIMARY KEY REFERENCES observation_runs(id) ON DELETE CASCADE,
  run_type TEXT NOT NULL CHECK (run_type IN ('scheduled', 'manual_official', 'verification', 'diagnostic', 'legacy')),
  panel_id TEXT NOT NULL DEFAULT 'legacy-ja',
  classified_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS observation_run_context (
  run_id TEXT PRIMARY KEY REFERENCES observation_runs(id) ON DELETE CASCADE,
  panel_id TEXT NOT NULL,
  panel_version TEXT NOT NULL,
  methodology_version TEXT NOT NULL,
  search_lang TEXT NOT NULL,
  country TEXT NOT NULL,
  ui_lang TEXT NOT NULL,
  safe_search TEXT NOT NULL,
  result_count INTEGER NOT NULL,
  top10_score INTEGER,
  top20_score INTEGER,
  run_status TEXT NOT NULL DEFAULT 'completed',
  api_requests INTEGER NOT NULL DEFAULT 0,
  http_checks INTEGER NOT NULL DEFAULT 0,
  search_departures INTEGER NOT NULL DEFAULT 0,
  web_disappearance_candidates INTEGER NOT NULL DEFAULT 0,
  confirmed_disappeared INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS search_rank_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES observation_runs(id) ON DELETE CASCADE,
  previous_run_id TEXT REFERENCES observation_runs(id) ON DELETE SET NULL,
  panel_id TEXT NOT NULL,
  query_id TEXT NOT NULL,
  query TEXT NOT NULL,
  domain TEXT NOT NULL,
  normalized_url TEXT NOT NULL,
  title TEXT,
  previous_rank INTEGER,
  current_rank INTEGER,
  search_status TEXT NOT NULL CHECK (search_status IN ('still_ranked', 'rank_changed', 'dropped_from_top_10', 'dropped_from_top_20', 'newly_ranked', 'returned_to_results')),
  observed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS url_verification_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  panel_id TEXT NOT NULL,
  normalized_url TEXT NOT NULL,
  last_seen_url TEXT NOT NULL,
  domain TEXT NOT NULL,
  query_id TEXT NOT NULL,
  query TEXT NOT NULL,
  first_observed_at TEXT NOT NULL,
  last_observed_at TEXT NOT NULL,
  next_verify_at TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 1,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  web_status TEXT NOT NULL DEFAULT 'unverifiable',
  last_http_status INTEGER,
  last_final_url TEXT,
  last_verified_at TEXT,
  last_error_reason TEXT,
  robots_status TEXT,
  UNIQUE(panel_id, normalized_url)
);

CREATE TABLE IF NOT EXISTS url_verification_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES observation_runs(id) ON DELETE CASCADE,
  panel_id TEXT NOT NULL,
  normalized_url TEXT NOT NULL,
  requested_method TEXT NOT NULL,
  final_url TEXT,
  http_status INTEGER,
  redirect_count INTEGER NOT NULL DEFAULT 0,
  content_type TEXT,
  page_title TEXT,
  title_hash TEXT,
  body_hash TEXT,
  result_state TEXT NOT NULL CHECK (result_state IN ('alive', 'redirected', 'moved', 'temporarily_unavailable', 'persistent_unavailable', 'disappeared', 'replaced_candidate', 'blocked', 'unverifiable')),
  error_reason TEXT,
  robots_status TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  observed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS disappearance_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  panel_id TEXT NOT NULL,
  run_id TEXT NOT NULL REFERENCES observation_runs(id) ON DELETE CASCADE,
  normalized_url TEXT NOT NULL,
  title TEXT,
  domain TEXT NOT NULL,
  query_id TEXT NOT NULL,
  query TEXT NOT NULL,
  previous_rank INTEGER,
  last_seen_at TEXT NOT NULL,
  search_status TEXT NOT NULL,
  web_status TEXT NOT NULL,
  redirect_url TEXT,
  confidence TEXT NOT NULL DEFAULT 'low',
  evidence TEXT NOT NULL,
  first_observed_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS api_usage_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  period_month TEXT NOT NULL,
  panel_id TEXT,
  purpose TEXT NOT NULL CHECK (purpose IN ('official', 'live', 'retry', 'diagnostic')),
  run_id TEXT,
  api_requests INTEGER NOT NULL DEFAULT 0,
  cache_hits INTEGER NOT NULL DEFAULT 0,
  recorded_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS live_usage_aggregate (
  period_month TEXT PRIMARY KEY,
  started_count INTEGER NOT NULL DEFAULT 0,
  completed_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  cache_hit_count INTEGER NOT NULL DEFAULT 0,
  api_request_count INTEGER NOT NULL DEFAULT 0,
  share_count INTEGER NOT NULL DEFAULT 0,
  language_usage_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);

ALTER TABLE observation_queries ADD COLUMN query_id TEXT;
ALTER TABLE observation_queries ADD COLUMN query_type TEXT;
ALTER TABLE observation_queries ADD COLUMN query_rationale TEXT;
ALTER TABLE observation_queries ADD COLUMN panel_id TEXT;
ALTER TABLE observation_queries ADD COLUMN top10_score INTEGER;
ALTER TABLE observation_queries ADD COLUMN top20_score INTEGER;
ALTER TABLE observation_queries ADD COLUMN top10_metrics_json TEXT;
ALTER TABLE observation_queries ADD COLUMN top20_metrics_json TEXT;
ALTER TABLE observation_pages ADD COLUMN query_id TEXT;
ALTER TABLE observation_pages ADD COLUMN panel_id TEXT;
ALTER TABLE observation_domain_scores ADD COLUMN top20_score INTEGER;
ALTER TABLE observation_run_context ADD COLUMN run_key TEXT;
ALTER TABLE live_runs ADD COLUMN search_lang TEXT NOT NULL DEFAULT 'ja';
ALTER TABLE live_runs ADD COLUMN country TEXT NOT NULL DEFAULT 'JP';
ALTER TABLE live_runs ADD COLUMN cache_ttl_seconds INTEGER NOT NULL DEFAULT 1800;

CREATE INDEX IF NOT EXISTS idx_observation_run_types_panel_type ON observation_run_types(panel_id, run_type);
CREATE INDEX IF NOT EXISTS idx_observation_run_context_panel_time ON observation_run_context(panel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_rank_history_run_query ON search_rank_history(run_id, query_id);
CREATE INDEX IF NOT EXISTS idx_search_rank_history_panel_url ON search_rank_history(panel_id, normalized_url, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_url_verification_queue_due ON url_verification_queue(panel_id, next_verify_at, priority DESC);
CREATE INDEX IF NOT EXISTS idx_url_verification_history_url ON url_verification_history(panel_id, normalized_url, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_disappearance_events_panel_time ON disappearance_events(panel_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_ledger_month ON api_usage_ledger(period_month, purpose);

INSERT OR IGNORE INTO observation_panels (panel_id, version, search_lang, country, ui_lang, safe_search, result_count, methodology_version, selection_reason, active, created_at)
VALUES ('legacy-ja', 'legacy', 'ja', 'JP', 'ja-JP', 'moderate', 10, 'mvp-1', 'Historical Japanese observation series retained for reference.', 0, '2026-08-20T00:00:00Z');

INSERT OR IGNORE INTO observation_run_types (run_id, run_type, panel_id, classified_at)
SELECT l.run_id, CASE WHEN l.run_type IN ('scheduled', 'manual_official', 'verification') THEN l.run_type ELSE 'legacy' END, 'legacy-ja', l.labeled_at
FROM observation_run_labels l;

INSERT OR IGNORE INTO observation_run_context (run_id, panel_id, panel_version, methodology_version, search_lang, country, ui_lang, safe_search, result_count, top10_score, top20_score, run_status, api_requests, created_at)
SELECT r.id, 'legacy-ja', 'legacy', 'mvp-1', 'ja', 'JP', 'ja-JP', 'moderate', 10, r.score, r.score, 'completed', 0, r.observed_at
FROM observation_runs r;

INSERT OR IGNORE INTO observation_panels (panel_id, version, search_lang, country, ui_lang, safe_search, result_count, methodology_version, selection_reason, active, created_at)
VALUES ('en-us-core-v1', '1.0.0', 'en', 'US', 'en-US', 'moderate', 20, 'en-core-1', 'Stable English-language information seeking in the United States across five balanced topic areas.', 1, '2026-08-20T00:00:00Z');

INSERT OR IGNORE INTO observation_query_registry (query_id, panel_id, version, domain, query, query_type, rationale, active_from, sort_order) VALUES
('health-01','en-us-core-v1','1.0.0','Health & Medicine','how to improve sleep','evergreen','Common long-lived health information need.','2026-08-20',1),
('health-02','en-us-core-v1','1.0.0','Health & Medicine','healthy meal plan ideas','evergreen','Broad, non-personal nutrition discovery query.','2026-08-20',2),
('health-03','en-us-core-v1','1.0.0','Health & Medicine','benefits of regular exercise','evergreen','Stable general health education query.','2026-08-20',3),
('health-04','en-us-core-v1','1.0.0','Health & Medicine','stress management techniques','evergreen','Long-lived self-care information query.','2026-08-20',4),
('health-05','en-us-core-v1','1.0.0','Health & Medicine','CDC flu vaccination recommendations','primary_source','Named US public-health guidance with a clear primary source.','2026-08-20',5),
('health-06','en-us-core-v1','1.0.0','Health & Medicine','WHO air quality guidelines','primary_source','Named international guidance with a clear primary source.','2026-08-20',6),
('health-07','en-us-core-v1','1.0.0','Health & Medicine','public health news','current_affairs','Ongoing public-health reporting without a single event dependency.','2026-08-20',7),
('health-08','en-us-core-v1','1.0.0','Health & Medicine','medical research news','current_affairs','Ongoing research coverage suitable for longitudinal comparison.','2026-08-20',8),
('health-09','en-us-core-v1','1.0.0','Health & Medicine','best sleep apps','rewrite_heavy','Comparison and roundup content is common.','2026-08-20',9),
('health-10','en-us-core-v1','1.0.0','Health & Medicine','healthy meal prep ideas','rewrite_heavy','Recipe and listicle duplication is observable without personal targeting.','2026-08-20',10),
('disaster-01','en-us-core-v1','1.0.0','Disaster & Preparedness','earthquake preparedness checklist','evergreen','Stable preparedness reference query.','2026-08-20',11),
('disaster-02','en-us-core-v1','1.0.0','Disaster & Preparedness','emergency kit checklist','evergreen','Common, long-lived preparedness query.','2026-08-20',12),
('disaster-03','en-us-core-v1','1.0.0','Disaster & Preparedness','family emergency plan','evergreen','Stable planning information need.','2026-08-20',13),
('disaster-04','en-us-core-v1','1.0.0','Disaster & Preparedness','wildfire preparedness','evergreen','Recurring hazard-preparedness query.','2026-08-20',14),
('disaster-05','en-us-core-v1','1.0.0','Disaster & Preparedness','FEMA disaster preparedness','primary_source','Named US emergency-management source.','2026-08-20',15),
('disaster-06','en-us-core-v1','1.0.0','Disaster & Preparedness','NOAA hurricane preparedness','primary_source','Named US science and weather source.','2026-08-20',16),
('disaster-07','en-us-core-v1','1.0.0','Disaster & Preparedness','hurricane forecast news','current_affairs','Recurring weather coverage with changing results.','2026-08-20',17),
('disaster-08','en-us-core-v1','1.0.0','Disaster & Preparedness','earthquake news United States','current_affairs','Ongoing public-interest coverage without a single event lock-in.','2026-08-20',18),
('disaster-09','en-us-core-v1','1.0.0','Disaster & Preparedness','best emergency radio','rewrite_heavy','Product roundups and affiliate rewrites are common.','2026-08-20',19),
('disaster-10','en-us-core-v1','1.0.0','Disaster & Preparedness','emergency food storage guide','rewrite_heavy','Guide and comparison content is common.','2026-08-20',20),
('science-01','en-us-core-v1','1.0.0','Science & Technology','how solar panels work','evergreen','Stable explanatory science query.','2026-08-20',21),
('science-02','en-us-core-v1','1.0.0','Science & Technology','climate change evidence','evergreen','Long-lived evidence-seeking query.','2026-08-20',22),
('science-03','en-us-core-v1','1.0.0','Science & Technology','quantum computing explained','evergreen','Stable technical explainer query.','2026-08-20',23),
('science-04','en-us-core-v1','1.0.0','Science & Technology','renewable energy benefits','evergreen','Broad, durable science and technology query.','2026-08-20',24),
('science-05','en-us-core-v1','1.0.0','Science & Technology','NASA climate data','primary_source','Named public scientific data source.','2026-08-20',25),
('science-06','en-us-core-v1','1.0.0','Science & Technology','NIST cybersecurity framework','primary_source','Named standards source with a clear primary document.','2026-08-20',26),
('science-07','en-us-core-v1','1.0.0','Science & Technology','space exploration news','current_affairs','Ongoing science reporting with changing results.','2026-08-20',27),
('science-08','en-us-core-v1','1.0.0','Science & Technology','AI research news','current_affairs','Current research coverage without AI-generation classification.','2026-08-20',28),
('science-09','en-us-core-v1','1.0.0','Science & Technology','best solar panels for home','rewrite_heavy','Comparison and review content is common.','2026-08-20',29),
('science-10','en-us-core-v1','1.0.0','Science & Technology','quantum computing explained simply','rewrite_heavy','Simplified explainers create a useful duplication test.','2026-08-20',30),
('public-01','en-us-core-v1','1.0.0','News & Public Affairs','how elections work in the United States','evergreen','Stable civic-information query.','2026-08-20',31),
('public-02','en-us-core-v1','1.0.0','News & Public Affairs','how does Congress work','evergreen','Long-lived civic explainer query.','2026-08-20',32),
('public-03','en-us-core-v1','1.0.0','News & Public Affairs','inflation explained','evergreen','Durable economic explainer query.','2026-08-20',33),
('public-04','en-us-core-v1','1.0.0','News & Public Affairs','public policy explained','evergreen','General public-information query.','2026-08-20',34),
('public-05','en-us-core-v1','1.0.0','News & Public Affairs','US Census data','primary_source','Named official statistical source.','2026-08-20',35),
('public-06','en-us-core-v1','1.0.0','News & Public Affairs','Supreme Court decisions','primary_source','Official legal decisions have identifiable primary sources.','2026-08-20',36),
('public-07','en-us-core-v1','1.0.0','News & Public Affairs','US news today','current_affairs','Broad current-news query to observe changing result composition.','2026-08-20',37),
('public-08','en-us-core-v1','1.0.0','News & Public Affairs','election news United States','current_affairs','Recurring civic news query without a single event name.','2026-08-20',38),
('public-09','en-us-core-v1','1.0.0','News & Public Affairs','news media bias comparison','rewrite_heavy','Comparison and summary content is common.','2026-08-20',39),
('public-10','en-us-core-v1','1.0.0','News & Public Affairs','best sources for current events','rewrite_heavy','Roundup and recommendation content is common.','2026-08-20',40),
('product-01','en-us-core-v1','1.0.0','Product Research','how to choose a laptop','evergreen','Stable product-research query.','2026-08-20',41),
('product-02','en-us-core-v1','1.0.0','Product Research','how to choose headphones','evergreen','Common long-lived product-research query.','2026-08-20',42),
('product-03','en-us-core-v1','1.0.0','Product Research','smartphone buying guide','evergreen','Durable consumer buying query.','2026-08-20',43),
('product-04','en-us-core-v1','1.0.0','Product Research','home printer buying guide','evergreen','Stable comparison and buying query.','2026-08-20',44),
('product-05','en-us-core-v1','1.0.0','Product Research','FTC consumer advice','primary_source','Named US consumer-protection source.','2026-08-20',45),
('product-06','en-us-core-v1','1.0.0','Product Research','ENERGY STAR product finder','primary_source','Named official efficiency source.','2026-08-20',46),
('product-07','en-us-core-v1','1.0.0','Product Research','consumer technology news','current_affairs','Ongoing product and technology coverage.','2026-08-20',47),
('product-08','en-us-core-v1','1.0.0','Product Research','product recall news','current_affairs','Changing safety and consumer-information query.','2026-08-20',48),
('product-09','en-us-core-v1','1.0.0','Product Research','best laptops for students','rewrite_heavy','Review and affiliate roundup content is common.','2026-08-20',49),
('product-10','en-us-core-v1','1.0.0','Product Research','noise cancelling headphones comparison','rewrite_heavy','Comparison content is common and easy to track.','2026-08-20',50);

CREATE UNIQUE INDEX IF NOT EXISTS idx_query_registry_panel_query ON observation_query_registry(panel_id, query, version);
CREATE UNIQUE INDEX IF NOT EXISTS idx_observation_run_context_key ON observation_run_context(panel_id, run_key) WHERE run_key IS NOT NULL;
