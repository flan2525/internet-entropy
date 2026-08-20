CREATE TABLE IF NOT EXISTS live_share_snapshots (
  result_id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  country TEXT NOT NULL,
  search_lang TEXT NOT NULL,
  result_json TEXT NOT NULL,
  methodology_version TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_live_share_snapshots_expires_at ON live_share_snapshots(expires_at);
