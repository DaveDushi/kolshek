-- KolShek initial schema
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
    ON sync_log (provider_id, started_at);
