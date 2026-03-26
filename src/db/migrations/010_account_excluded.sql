-- Add excluded flag to accounts for per-account sync filtering.
-- Excluded accounts are skipped during sync (no balance update, no transactions).
ALTER TABLE accounts ADD COLUMN excluded INTEGER NOT NULL DEFAULT 0;
