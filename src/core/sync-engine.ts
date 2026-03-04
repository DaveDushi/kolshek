import { subDays, formatISO, parseISO } from "date-fns";
import { roundToNearestMinutes } from "date-fns";
import type {
  AppConfig,
  ProviderSyncResult,
  SyncResult,
  TransactionInput,
  TransactionStatus,
  TransactionType,
} from "../types/index.js";
import { PROVIDERS, isValidCompanyId } from "../types/index.js";
import { loadConfig } from "../config/loader.js";
import { getCredentials } from "../security/keychain.js";
import { initDatabase, getDatabase } from "../db/database.js";
import { getDbPath, ensureDirectories } from "../config/loader.js";
import {
  getProviderByCompanyId,
  createProvider,
  updateLastSynced,
  listProviders,
} from "../db/repositories/providers.js";
import { upsertAccount } from "../db/repositories/accounts.js";
import { upsertTransaction } from "../db/repositories/transactions.js";
import {
  createSyncLog,
  completeSyncLog,
  getLastSuccessfulSync,
} from "../db/repositories/sync-log.js";
import {
  findChromePath,
  launchBrowser,
  closeBrowser,
  scrapeProvider,
  type ScrapeResult,
} from "./scraper.js";
import { sanitizeErrorMessage } from "./sanitize.js";
import { translateDescription } from "./merchant-names.js";

// ---------------------------------------------------------------------------
// Deduplication helpers
// ---------------------------------------------------------------------------

export function transactionHash(
  tx: {
    date: string;
    chargedAmount: number;
    description: string;
    memo?: string | null;
  },
  companyId: string,
  accountNumber: string,
): string {
  const date = roundToNearestMinutes(parseISO(tx.date)).toISOString();
  return [
    date,
    tx.chargedAmount,
    tx.description,
    tx.memo,
    companyId,
    accountNumber,
  ]
    .map((p) => String(p ?? ""))
    .join("_");
}

export function transactionUniqueId(
  tx: {
    date: string;
    chargedAmount: number;
    description: string;
    memo?: string | null;
    identifier?: string | number | null;
  },
  companyId: string,
  accountNumber: string,
): string {
  const date = formatISO(parseISO(tx.date), { representation: "date" });
  return [
    date,
    companyId,
    accountNumber,
    tx.chargedAmount,
    tx.identifier || `${tx.description}_${tx.memo}`,
  ]
    .map((p) => String(p ?? "").trim())
    .join("_");
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface SyncOptions {
  /** Override config — mainly for testing */
  config?: AppConfig;
  /** Override chrome path */
  chromePath?: string;
  /** Progress callback */
  onProgress?: (companyId: string, stage: string) => void;
  /** Override concurrency */
  concurrency?: number;
  /** Override start date for scraping */
  fromDate?: Date;
  /** End date (currently unused by scrapers, reserved for filtering) */
  toDate?: Date;
  /** Force re-fetch even if recently synced */
  force?: boolean;
}

// ---------------------------------------------------------------------------
// Main sync
// ---------------------------------------------------------------------------

export async function syncProviders(
  providerIds?: string[],
  options?: SyncOptions,
): Promise<SyncResult> {
  const config = options?.config ?? (await loadConfig());

  await ensureDirectories();
  const dbPath = getDbPath();

  // Ensure database is initialized
  try {
    getDatabase();
  } catch {
    initDatabase(dbPath);
  }

  // Determine which providers to sync
  const targetIds = providerIds ?? listProviders().map((p) => p.companyId);
  if (targetIds.length === 0) {
    return { results: [], totalAdded: 0, totalUpdated: 0, hasErrors: false };
  }

  // Find Chrome
  const chromePath =
    options?.chromePath ?? config.chromePath ?? findChromePath();
  if (!chromePath) {
    return {
      results: targetIds.map((id) => ({
        companyId: id,
        success: false,
        accountsFound: 0,
        transactionsAdded: 0,
        transactionsUpdated: 0,
        error: "Chrome not found. Set KOLSHEK_CHROME_PATH or install Chrome.",
        durationMs: 0,
      })),
      totalAdded: 0,
      totalUpdated: 0,
      hasErrors: true,
    };
  }

  // Launch a shared browser
  const browser = await launchBrowser(chromePath);

  const concurrency = options?.concurrency ?? config.concurrency;

  try {
    const results = await runWithConcurrency(
      targetIds,
      concurrency,
      (companyId) =>
        syncSingleProvider(companyId, config, chromePath, browser, options),
    );

    const totalAdded = results.reduce((s, r) => s + r.transactionsAdded, 0);
    const totalUpdated = results.reduce((s, r) => s + r.transactionsUpdated, 0);
    const hasErrors = results.some((r) => !r.success);

    return { results, totalAdded, totalUpdated, hasErrors };
  } finally {
    await closeBrowser(browser);
  }
}

// ---------------------------------------------------------------------------
// Single provider sync
// ---------------------------------------------------------------------------

async function syncSingleProvider(
  companyId: string,
  config: AppConfig,
  chromePath: string,
  browser: any,
  syncOptions?: SyncOptions,
): Promise<ProviderSyncResult> {
  const onProgress = syncOptions?.onProgress;
  const startTime = Date.now();

  if (!isValidCompanyId(companyId)) {
    return {
      companyId,
      success: false,
      accountsFound: 0,
      transactionsAdded: 0,
      transactionsUpdated: 0,
      error: `Unknown provider: ${companyId}`,
      durationMs: Date.now() - startTime,
    };
  }

  onProgress?.(companyId, "loading_credentials");

  // Get credentials
  const credentials = await getCredentials(companyId);
  if (!credentials) {
    return {
      companyId,
      success: false,
      accountsFound: 0,
      transactionsAdded: 0,
      transactionsUpdated: 0,
      error: `No credentials found for ${companyId}. Run 'kolshek providers add' first.`,
      durationMs: Date.now() - startTime,
    };
  }

  try {
    // Get or create provider record
    let provider = getProviderByCompanyId(companyId);
    if (!provider) {
      const info = PROVIDERS[companyId];
      provider = createProvider(companyId, info.displayName, info.type);
    }

    // Determine start date
    const startDate =
      syncOptions?.fromDate ?? computeStartDate(provider.id, config);
    const startDateStr = formatISO(startDate, { representation: "date" });

    // Create sync log entry
    const syncLog = createSyncLog(provider.id, startDateStr);

    onProgress?.(companyId, "scraping");

    // Scrape
    let scrapeResult: ScrapeResult;
    try {
      scrapeResult = await scrapeProvider({
        companyId,
        credentials,
        startDate,
        chromePath,
        browser,
        onProgress: onProgress
          ? (type: string) => onProgress(companyId, type)
          : undefined,
        scraperOptions: {
          timeout: 120000, // 2 minutes max per navigation
        },
      });
    } catch (err) {
      const errMsg = sanitizeErrorMessage(
        err instanceof Error ? err.message : String(err),
        credentials,
      );
      completeSyncLog(syncLog.id, "error", 0, 0, errMsg);
      return {
        companyId,
        success: false,
        accountsFound: 0,
        transactionsAdded: 0,
        transactionsUpdated: 0,
        error: errMsg,
        durationMs: Date.now() - startTime,
      };
    }

    if (!scrapeResult.success) {
      const safeError = sanitizeErrorMessage(
        scrapeResult.error ?? "",
        credentials,
      );
      completeSyncLog(syncLog.id, "error", 0, 0, safeError);
      return {
        companyId,
        success: false,
        accountsFound: scrapeResult.accounts.length,
        transactionsAdded: 0,
        transactionsUpdated: 0,
        error: safeError,
        durationMs: Date.now() - startTime,
      };
    }

    onProgress?.(companyId, "processing");

    // Process accounts and transactions inside a DB transaction for atomicity
    const db = getDatabase();
    let totalAdded = 0;
    let totalUpdated = 0;

    db.run("BEGIN");
    try {
      for (const acct of scrapeResult.accounts) {
        const account = upsertAccount(
          provider.id,
          acct.accountNumber,
          acct.balance,
        );

        // Deduplicate and upsert transactions
        const seen = new Set<string>();

        for (const tx of acct.txns) {
          const hash = transactionHash(tx, companyId, acct.accountNumber);
          if (seen.has(hash)) continue;
          seen.add(hash);

          const uniqueId = transactionUniqueId(
            tx,
            companyId,
            acct.accountNumber,
          );

          const input: TransactionInput = {
            accountId: account.id,
            type: mapTransactionType(tx.type),
            identifier: tx.identifier ?? null,
            date: tx.date,
            processedDate: tx.processedDate ?? tx.date,
            originalAmount: tx.originalAmount ?? tx.chargedAmount,
            originalCurrency: tx.originalCurrency ?? "ILS",
            chargedAmount: tx.chargedAmount,
            chargedCurrency: tx.chargedCurrency ?? null,
            description: tx.description ?? "",
            descriptionEn: translateDescription(tx.description ?? "") ?? null,
            memo: tx.memo ?? null,
            status: mapTransactionStatus(tx.status),
            installmentNumber: tx.installments?.number ?? null,
            installmentTotal: tx.installments?.total ?? null,
            category: tx.category ?? null,
            hash,
            uniqueId,
          };

          const result = upsertTransaction(input);
          if (result.action === "inserted") totalAdded++;
          else if (result.action === "updated") totalUpdated++;
        }
      }

      // Update provider last synced
      updateLastSynced(provider.id, new Date().toISOString());

      // Complete sync log
      completeSyncLog(syncLog.id, "success", totalAdded, totalUpdated);

      db.run("COMMIT");
    } catch (err) {
      db.run("ROLLBACK");
      throw err;
    }

    return {
      companyId,
      success: true,
      accountsFound: scrapeResult.accounts.length,
      transactionsAdded: totalAdded,
      transactionsUpdated: totalUpdated,
      durationMs: Date.now() - startTime,
    };
  } finally {
    // Zero credential values to minimize exposure window
    for (const key of Object.keys(credentials)) {
      credentials[key] = "";
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeStartDate(providerId: number, config: AppConfig): Date {
  const lastSync = getLastSuccessfulSync(providerId);
  if (lastSync) {
    // Go back syncOverlapDays from when the last sync completed to catch late-posting transactions
    const referenceDate = lastSync.completedAt
      ? parseISO(lastSync.completedAt)
      : parseISO(lastSync.scrapeStartDate);
    return subDays(referenceDate, config.syncOverlapDays);
  }
  // First sync: go back initialSyncDays
  return subDays(new Date(), config.initialSyncDays);
}

function mapTransactionType(type?: string): TransactionType {
  if (type === "installments") return "installments";
  return "normal";
}

function mapTransactionStatus(status?: string): TransactionStatus {
  if (status === "pending") return "pending";
  return "completed";
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  const executing: Set<Promise<void>> = new Set();

  for (let i = 0; i < items.length; i++) {
    const index = i;
    const p = fn(items[index]).then((result) => {
      results[index] = result;
    });

    const tracked = p.then(
      () => {
        executing.delete(tracked);
      },
      () => {
        executing.delete(tracked);
      },
    );
    executing.add(tracked);

    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
}
