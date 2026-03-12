-- Upgrade category_rules to multi-field JSON conditions + priority.
PRAGMA foreign_keys=OFF;

CREATE TABLE category_rules_v2 (
  id INTEGER PRIMARY KEY,
  category TEXT NOT NULL,
  conditions TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO category_rules_v2 (id, category, conditions, priority, created_at)
  SELECT id, category,
    json_object('description', json_object('pattern', match_pattern, 'mode', 'substring')),
    0,
    created_at
  FROM category_rules;

DROP TABLE category_rules;
ALTER TABLE category_rules_v2 RENAME TO category_rules;

PRAGMA foreign_keys=ON;
