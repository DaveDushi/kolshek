CREATE TABLE IF NOT EXISTS translation_rules (
  id INTEGER PRIMARY KEY,
  english_name TEXT NOT NULL,
  match_pattern TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
