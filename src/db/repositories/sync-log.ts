import type { SyncLog } from "../../types/index.js";
import { getDatabase } from "../database.js";

interface SyncLogRow {
  id: number;
  provider_id: number;
  started_at: string;
  completed_at: string | null;
  status: string;
  transactions_added: number;
  transactions_updated: number;
  error_message: string | null;
  scrape_start_date: string;
}

function rowToSyncLog(row: SyncLogRow): SyncLog {
  return {
    id: row.id,
    providerId: row.provider_id,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    status: row.status as SyncLog["status"],
    transactionsAdded: row.transactions_added,
    transactionsUpdated: row.transactions_updated,
    errorMessage: row.error_message,
    scrapeStartDate: row.scrape_start_date,
  };
}

export function createSyncLog(
  providerId: number,
  scrapeStartDate: string,
): SyncLog {
  const db = getDatabase();
  const row = db
    .prepare(
      `INSERT INTO sync_log (provider_id, status, scrape_start_date)
       VALUES ($providerId, 'running', $scrapeStartDate)
       RETURNING *`,
    )
    .get({
      $providerId: providerId,
      $scrapeStartDate: scrapeStartDate,
    }) as SyncLogRow;

  return rowToSyncLog(row);
}

export function completeSyncLog(
  id: number,
  status: "success" | "error",
  transactionsAdded: number,
  transactionsUpdated: number,
  errorMessage?: string,
): void {
  const db = getDatabase();
  db.prepare(
    `UPDATE sync_log SET
       completed_at = datetime('now'),
       status = $status,
       transactions_added = $transactionsAdded,
       transactions_updated = $transactionsUpdated,
       error_message = $errorMessage
     WHERE id = $id`,
  ).run({
    $id: id,
    $status: status,
    $transactionsAdded: transactionsAdded,
    $transactionsUpdated: transactionsUpdated,
    $errorMessage: errorMessage ?? null,
  });
}

export function getLastSuccessfulSync(providerId: number): SyncLog | null {
  const db = getDatabase();
  const row = db
    .prepare(
      `SELECT * FROM sync_log
       WHERE provider_id = $providerId AND status = 'success'
       ORDER BY started_at DESC
       LIMIT 1`,
    )
    .get({ $providerId: providerId }) as SyncLogRow | null;

  return row ? rowToSyncLog(row) : null;
}
