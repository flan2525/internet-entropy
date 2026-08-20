CREATE TABLE IF NOT EXISTS observation_run_labels (
  run_id TEXT PRIMARY KEY REFERENCES observation_runs(id) ON DELETE CASCADE,
  run_type TEXT NOT NULL CHECK (run_type IN ('scheduled', 'manual_official', 'verification')),
  labeled_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_observation_run_labels_type ON observation_run_labels(run_type);

CREATE TABLE IF NOT EXISTS observation_page_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES observation_runs(id) ON DELETE CASCADE,
  previous_run_id TEXT REFERENCES observation_runs(id) ON DELETE SET NULL,
  domain TEXT NOT NULL,
  query TEXT NOT NULL,
  normalized_url TEXT NOT NULL,
  change_type TEXT NOT NULL CHECK (change_type IN ('added', 'disappeared', 'persisted', 'rank_changed', 'redirect', 'unavailable')),
  previous_rank INTEGER,
  current_rank INTEGER,
  current_http_status INTEGER,
  redirect_url TEXT,
  error_reason TEXT,
  observed_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_observation_page_changes_run_id ON observation_page_changes(run_id);
CREATE INDEX IF NOT EXISTS idx_observation_page_changes_query_url ON observation_page_changes(query, normalized_url);

INSERT OR IGNORE INTO observation_run_labels (run_id, run_type, labeled_at) VALUES
  ('056ed624-9a60-4cbd-b153-34b40564b8c9', 'verification', '2026-08-20T02:55:00.000Z'),
  ('aede030a-b912-4d75-bc09-3144095e24d2', 'verification', '2026-08-20T02:55:00.000Z'),
  ('ed0a4863-681b-4b60-bed9-dda56f4736c1', 'verification', '2026-08-20T02:55:00.000Z'),
  ('37d62a82-4006-4446-9d5c-83a08fdfa85e', 'manual_official', '2026-08-20T02:55:00.000Z');
