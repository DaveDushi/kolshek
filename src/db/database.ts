import { Database } from "bun:sqlite";
import { existsSync } from "fs";
import { restrictPathToOwner } from "../security/permissions.js";

let _db: Database | null = null;

/**
 * Initialize the SQLite database: open, configure pragmas, run migrations.
 */
export function initDatabase(dbPath: string): Database {
  if (_db) return _db;

  const db = new Database(dbPath, { create: true });

  // Restrict DB file permissions (Unix: chmod, Windows: icacls)
  restrictPathToOwner(dbPath);

  db.run("PRAGMA journal_mode=WAL");
  db.run("PRAGMA foreign_keys=ON");
  db.run("PRAGMA busy_timeout=5000");
  db.run("PRAGMA temp_store=2");

  runMigrations(db);

  // Restrict WAL/SHM files created by WAL mode
  const walPath = dbPath + "-wal";
  const shmPath = dbPath + "-shm";
  if (existsSync(walPath)) restrictPathToOwner(walPath);
  if (existsSync(shmPath)) restrictPathToOwner(shmPath);

  _db = db;
  return db;
}

/**
 * Get the singleton database instance. Throws if not initialized.
 */
export function getDatabase(): Database {
  if (!_db) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return _db;
}

/**
 * Close the database connection and clear the singleton.
 */
export function closeDatabase(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

// Migrations embedded as strings so they survive bun build --compile
// (the compiled binary cannot read .sql files from disk).
const MIGRATIONS: [string, string][] = [
  ["001_initial.sql", `-- KolShek initial schema
-- Providers: banks and credit card companies
CREATE TABLE IF NOT EXISTS providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('bank', 'credit_card')),
    last_synced_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Accounts: specific accounts under a provider
CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    account_number TEXT NOT NULL,
    display_name TEXT,
    balance REAL,
    currency TEXT NOT NULL DEFAULT 'ILS',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (provider_id, account_number)
);

-- Transactions: maps 1:1 with israeli-bank-scrapers Transaction fields
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('normal', 'installments')),
    identifier TEXT,
    date TEXT NOT NULL,
    processed_date TEXT NOT NULL,
    original_amount REAL NOT NULL,
    original_currency TEXT NOT NULL,
    charged_amount REAL NOT NULL,
    charged_currency TEXT,
    description TEXT NOT NULL,
    memo TEXT,
    status TEXT NOT NULL CHECK (status IN ('completed', 'pending')),
    installment_number INTEGER,
    installment_total INTEGER,
    category TEXT,
    hash TEXT NOT NULL,
    unique_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Dedup index: primary deduplication on hash per account
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_account_hash
    ON transactions (account_id, hash);

-- Query indexes
CREATE INDEX IF NOT EXISTS idx_transactions_date
    ON transactions (date);

CREATE INDEX IF NOT EXISTS idx_transactions_account_date
    ON transactions (account_id, date);

CREATE INDEX IF NOT EXISTS idx_transactions_status
    ON transactions (status);

-- Sync log: tracks scrape operations per provider
CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    status TEXT NOT NULL CHECK (status IN ('running', 'success', 'error')),
    transactions_added INTEGER NOT NULL DEFAULT 0,
    transactions_updated INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    scrape_start_date TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_log_provider
    ON sync_log (provider_id, started_at);`],

  ["002_add_description_en.sql", `ALTER TABLE transactions ADD COLUMN description_en TEXT;`],

  ["003_category_rules.sql", `CREATE TABLE IF NOT EXISTS category_rules (
  id INTEGER PRIMARY KEY,
  category TEXT NOT NULL,
  match_pattern TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`],

  ["004_translation_rules.sql", `CREATE TABLE IF NOT EXISTS translation_rules (
  id INTEGER PRIMARY KEY,
  english_name TEXT NOT NULL,
  match_pattern TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`],

  ["005_provider_alias.sql", `-- Add alias column to providers for multi-instance support
PRAGMA foreign_keys=OFF;

ALTER TABLE providers ADD COLUMN alias TEXT;
UPDATE providers SET alias = company_id WHERE alias IS NULL;

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

PRAGMA foreign_keys=ON;`],

  ["006_sync_log_end_date.sql", `ALTER TABLE sync_log ADD COLUMN scrape_end_date TEXT;

UPDATE sync_log SET scrape_end_date = COALESCE(
    DATE(completed_at),
    DATE(started_at)
) WHERE scrape_end_date IS NULL;`],

  ["007_merge_duplicate_accounts.sql", `-- Merge duplicate accounts that share (company_id, account_number) across providers.
-- Keeps the lowest-id account as the winner per group.
PRAGMA foreign_keys=OFF;

-- Step 1: temp table mapping loser account ids to winner account ids
CREATE TEMP TABLE _account_merges AS
SELECT
  loser.id AS loser_id,
  winner.winner_id
FROM accounts loser
JOIN providers loser_p ON loser.provider_id = loser_p.id
JOIN (
  SELECT MIN(a.id) AS winner_id, p.company_id, a.account_number
  FROM accounts a
  JOIN providers p ON a.provider_id = p.id
  GROUP BY p.company_id, a.account_number
) winner ON loser_p.company_id = winner.company_id
        AND loser.account_number = winner.account_number
        AND loser.id != winner.winner_id;

-- Step 2: delete duplicate transactions (same hash already exists in winner account)
DELETE FROM transactions
WHERE id IN (
  SELECT t_loser.id
  FROM transactions t_loser
  JOIN _account_merges am ON t_loser.account_id = am.loser_id
  JOIN transactions t_winner ON t_winner.account_id = am.winner_id
                            AND t_winner.hash = t_loser.hash
);

-- Step 3: reassign remaining transactions from loser to winner
UPDATE transactions
SET account_id = (
  SELECT am.winner_id FROM _account_merges am
  WHERE am.loser_id = transactions.account_id
)
WHERE account_id IN (SELECT loser_id FROM _account_merges);

-- Step 4: delete the now-empty loser accounts
DELETE FROM accounts WHERE id IN (SELECT loser_id FROM _account_merges);

DROP TABLE _account_merges;

PRAGMA foreign_keys=ON;`],

  ["008_cc_billing_category_rules.sql", `SELECT 1; -- removed: seed rules no longer auto-inserted`],

  ["009_multi_field_rules.sql", `-- Upgrade category_rules to multi-field JSON conditions + priority.
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

PRAGMA foreign_keys=ON;`],

  ["010_spending_excludes.sql", `-- User-defined categories to exclude from spending/lifestyle analysis.
-- Starts empty — the user decides what to exclude.
CREATE TABLE IF NOT EXISTS spending_excludes (
  category TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`],

  ["011_categories.sql", `-- First-class categories table so users can pre-create category names.
CREATE TABLE IF NOT EXISTS categories (
  name TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Seed from existing transaction and rule data
INSERT OR IGNORE INTO categories (name)
  SELECT COALESCE(category, 'Uncategorized') FROM transactions
  UNION
  SELECT category FROM category_rules;`],
];

// Run all pending SQL migrations.
// Tracks applied migrations in a _migrations table.
function runMigrations(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  for (const [name, sql] of MIGRATIONS) {
    const applied = db
      .prepare("SELECT 1 FROM _migrations WHERE name = $name")
      .get({ $name: name });

    if (!applied) {
      db.exec(sql);
      db.prepare("INSERT INTO _migrations (name) VALUES ($name)").run({
        $name: name,
      });
    }
  }
}
