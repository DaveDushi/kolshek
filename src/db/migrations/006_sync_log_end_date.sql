-- Add scrape_end_date to sync_log for tracking the full date range of each sync
ALTER TABLE sync_log ADD COLUMN scrape_end_date TEXT;

-- Backfill existing rows: end date is the date the sync completed (or started if not completed)
UPDATE sync_log SET scrape_end_date = COALESCE(
    DATE(completed_at),
    DATE(started_at)
) WHERE scrape_end_date IS NULL;
