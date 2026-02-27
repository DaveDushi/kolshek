/**
 * Application configuration types.
 */

export interface AppConfig {
  /** Path to Chrome/Chromium executable */
  chromePath?: string;
  /** Default number of days to fetch on first sync */
  initialSyncDays: number;
  /** Overlap window in days for incremental sync */
  syncOverlapDays: number;
  /** Max concurrent scraper instances */
  concurrency: number;
  /** Scraper navigation retry count */
  navigationRetryCount: number;
  /** Scraper viewport size */
  viewport: { width: number; height: number };
  /** Path to store failure screenshots */
  screenshotPath?: string;
  /** Date display format for human output */
  dateFormat: string;
}

export const DEFAULT_CONFIG: AppConfig = {
  initialSyncDays: 90,
  syncOverlapDays: 7,
  concurrency: 2,
  navigationRetryCount: 3,
  viewport: { width: 1920, height: 1080 },
  dateFormat: "dd/MM/yy",
};

/** Sync result for a single provider */
export interface ProviderSyncResult {
  companyId: string;
  success: boolean;
  accountsFound: number;
  transactionsAdded: number;
  transactionsUpdated: number;
  error?: string;
  durationMs: number;
}

/** Overall sync result */
export interface SyncResult {
  results: ProviderSyncResult[];
  totalAdded: number;
  totalUpdated: number;
  hasErrors: boolean;
}

/** Sync log record from the database */
export interface SyncLog {
  id: number;
  providerId: number;
  startedAt: string;
  completedAt: string | null;
  status: "running" | "success" | "error";
  transactionsAdded: number;
  transactionsUpdated: number;
  errorMessage: string | null;
  scrapeStartDate: string;
}
