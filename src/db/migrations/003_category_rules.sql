CREATE TABLE IF NOT EXISTS category_rules (
  id INTEGER PRIMARY KEY,
  category TEXT NOT NULL,
  match_pattern TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
