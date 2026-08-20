CREATE TABLE IF NOT EXISTS observation_queries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES observation_runs(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  query TEXT NOT NULL,
  requested_count INTEGER NOT NULL,
  returned_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  score INTEGER,
  metrics_json TEXT NOT NULL DEFAULT '{}',
  missing_metrics TEXT NOT NULL DEFAULT '',
  error_reason TEXT,
  observed_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_observation_queries_run_id ON observation_queries(run_id);
CREATE INDEX IF NOT EXISTS idx_observation_pages_run_normalized_url ON observation_pages(run_id, normalized_url);
