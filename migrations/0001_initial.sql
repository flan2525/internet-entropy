PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS observation_runs (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  score INTEGER,
  analyzed_pages INTEGER NOT NULL DEFAULT 0,
  calculation_version TEXT NOT NULL,
  data_source TEXT NOT NULL DEFAULT 'brave'
);

CREATE TABLE IF NOT EXISTS observation_domain_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES observation_runs(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  score INTEGER,
  analyzed_pages INTEGER NOT NULL DEFAULT 0,
  observed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS observation_pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES observation_runs(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  query TEXT NOT NULL,
  rank INTEGER NOT NULL,
  url TEXT NOT NULL,
  normalized_url TEXT NOT NULL,
  hostname TEXT NOT NULL,
  title TEXT,
  snippet TEXT,
  http_status INTEGER,
  redirect_url TEXT,
  content_type TEXT,
  body_hash TEXT,
  cluster_id TEXT,
  primary_likelihood REAL,
  error_reason TEXT,
  observed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS live_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL,
  source TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_observation_runs_observed_at ON observation_runs(observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_domain_scores_run_id ON observation_domain_scores(run_id);
CREATE INDEX IF NOT EXISTS idx_live_runs_query_created_at ON live_runs(query, created_at DESC);
