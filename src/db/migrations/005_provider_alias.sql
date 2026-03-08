-- Add alias column to providers for multi-instance support
-- (e.g. two Leumi accounts: "leumi-personal", "leumi-joint")

-- IMPORTANT: Disable foreign keys during table rebuild to prevent
-- ON DELETE CASCADE from wiping accounts/transactions when we drop the old table.
PRAGMA foreign_keys=OFF;

-- Step 1: Add alias column and backfill with company_id
ALTER TABLE providers ADD COLUMN alias TEXT;
UPDATE providers SET alias = company_id WHERE alias IS NULL;

-- Step 2: Rebuild table to change constraints
--   Remove: UNIQUE(company_id)
--   Add:    UNIQUE(alias), NOT NULL on alias
CREATE TABLE providers_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id TEXT NOT NULL,
    alias TEXT NOT NULL,
    display_name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('bank', 'credit_card')),
    last_synced_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (alias)
);

INSERT INTO providers_new (id, company_id, alias, display_name, type, last_synced_at, created_at)
    SELECT id, company_id, alias, display_name, type, last_synced_at, created_at
    FROM providers;

DROP TABLE providers;
ALTER TABLE providers_new RENAME TO providers;

PRAGMA foreign_keys=ON;
