// Sync service — orchestrates bank scraping, DB upserts, and post-sync rules.
// Moved from core/sync-engine.ts to fix core purity violation (core was importing db).

import { subDays, formatISO, parseISO } from "date-fns";
import type {
  AppConfig,
  Provider,
  ProviderSyncResult,
  SyncResult,
  TransactionInput,
} from "../types/index.js";
import { isValidCompanyId, getScraperMaxDays } from "../types/index.js";
import { loadConfig } from "../config/loader.js";
import { getCredentials } from "../security/keychain.js";
import { initDatabase, getDatabase } from "../db/database.js";
import { getDbPath, ensureDirectories } from "../config/loader.js";
import {
  updateLastSynced,
  listProviders,
} from "../db/repositories/providers.js";
import {
  upsertAccount,
  isAccountExcludedByKey,
} from "../db/repositories/accounts.js";
import { upsertTransaction } from "../db/repositories/transactions.js";
import {
  createSyncLog,
  completeSyncLog,
  getLastSuccessfulSync,
} from "../db/repositories/sync-log.js";
import { applyCategoryRules } from "../db/repositories/categories.js";
import { applyTranslationRules } from "../db/repositories/translations.js";
import { normalizeCurrency } from "../shared/currency.js";
import {
  transactionHash,
  transactionUniqueId,
  mapTransactionType,
  mapTransactionStatus,
  runWithConcurrency,
} from "../core/sync-engine.js";
import {
  findChromePath,
  launchBrowser,
  closeBrowser,
  scrapeProvider,
  type ScrapeResult,
} from "../core/scraper.js";
import { sanitizeErrorMessage } from "../core/sanitize.js";

// Re-export SyncOptions so consumers don't need to know about the split
export interface SyncOptions {
  config?: AppConfig;
  chromePath?: string;
  onProgress?: (companyId: string, stage: string) => void;
  concurrency?: number;
  fromDate?: Date;
  toDate?: Date;
  force?: boolean;
  stealth?: boolean;
  visible?: boolean;
  signal?: AbortSignal;
}

export interface FetchResult extends SyncResult {
  postProcessing: {
    translationsApplied: number;
    categoriesApplied: number;
  };
}

// Main sync entry point — fetches from banks and auto-applies rules afterward.
// Both CLI and web dashboard should use this to ensure feature parity.
export async function fetchAndApplyRules(
  providers?: Provider[],
  options?: SyncOptions,
): Promise<FetchResult> {
  const syncResult = await syncProviders(providers, options);

  // Auto-apply translation and category rules after successful sync
  let translationsApplied = 0;
  let categoriesApplied = 0;
  if (!syncResult.hasErrors || syncResult.totalAdded > 0) {
    const transResult = applyTranslationRules();
    translationsApplied = transResult.applied;

    const catResult = applyCategoryRules();
    categoriesApplied = catResult.applied;
  }

  return {
    ...syncResult,
    postProcessing: { translationsApplied, categoriesApplied },
  };
}

// Raw sync without post-processing — for cases where caller manages rules
export async function syncProviders(
  providers?: Provider[],
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
  const targets = providers ?? listProviders();
  if (targets.length === 0) {
    return { results: [], totalAdded: 0, totalUpdated: 0, hasErrors: false };
  }

  // Find Chrome
  const chromePath =
    options?.chromePath ?? config.chromePath ?? findChromePath();
  if (!chromePath) {
    return {
      results: targets.map((p) => ({
        companyId: p.companyId,
        alias: p.alias,
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
  const browser = await launchBrowser(chromePath, {
    stealth: options?.stealth,
    headless: options?.visible ? false : undefined,
  });

  const concurrency = options?.concurrency ?? config.concurrency;

  try {
    const results = await runWithConcurrency(
      targets,
      concurrency,
      (provider) =>
        syncSingleProvider(provider, config, chromePath, browser, options),
      options?.signal,
    );

    const totalAdded = results.reduce((s, r) => s + r.transactionsAdded, 0);
    const totalUpdated = results.reduce((s, r) => s + r.transactionsUpdated, 0);
    const hasErrors = results.some((r) => !r.success);

    return { results, totalAdded, totalUpdated, hasErrors };
  } finally {
    await closeBrowser(browser);
  }
}

async function syncSingleProvider(
  provider: Provider,
  config: AppConfig,
  chromePath: string,
  browser: any,
  syncOptions?: SyncOptions,
): Promise<ProviderSyncResult> {
  const { companyId, alias } = provider;
  const onProgress = syncOptions?.onProgress;
  const startTime = Date.now();

  if (!isValidCompanyId(companyId)) {
    return {
      companyId,
      alias,
      success: false,
      accountsFound: 0,
      transactionsAdded: 0,
      transactionsUpdated: 0,
      error: `Unknown provider: ${companyId}`,
      durationMs: Date.now() - startTime,
    };
  }

  // Check for cancellation before starting
  if (syncOptions?.signal?.aborted) {
    return {
      companyId,
      alias,
      success: false,
      accountsFound: 0,
      transactionsAdded: 0,
      transactionsUpdated: 0,
      error: "Sync cancelled",
      durationMs: Date.now() - startTime,
    };
  }

  onProgress?.(alias, "loading_credentials");

  // Get credentials keyed by alias
  const credentials = await getCredentials(alias);
  if (!credentials) {
    return {
      companyId,
      alias,
      success: false,
      accountsFound: 0,
      transactionsAdded: 0,
      transactionsUpdated: 0,
      error: `No credentials found for ${alias}. Run 'kolshek providers add' first.`,
      durationMs: Date.now() - startTime,
    };
  }

  try {
    // Determine start date, clamped to scraper's max history limit
    const maxDays = getScraperMaxDays(companyId);
    const earliestAllowed = subDays(new Date(), maxDays);
    const rawStartDate =
      syncOptions?.fromDate ?? computeStartDate(provider.id, companyId, config);
    const startDate = rawStartDate < earliestAllowed ? earliestAllowed : rawStartDate;
    const startDateStr = formatISO(startDate, { representation: "date" });
    const endDate = new Date();
    const endDateStr = formatISO(endDate, { representation: "date" });

    // Create sync log entry
    const syncLog = createSyncLog(provider.id, startDateStr, endDateStr);

    onProgress?.(alias, "scraping");

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
          ? (type: string) => onProgress(alias, type)
          : undefined,
        scraperOptions: {
          timeout: 120000, // 2 minutes max per navigation
        },
        signal: syncOptions?.signal,
      });
    } catch (err) {
      const errMsg = sanitizeErrorMessage(
        err instanceof Error ? err.message : String(err),
        credentials,
      );
      completeSyncLog(syncLog.id, "error", 0, 0, errMsg);
      return {
        companyId,
        alias,
        success: false,
        accountsFound: 0,
        transactionsAdded: 0,
        transactionsUpdated: 0,
        error: errMsg,
        durationMs: Date.now() - startTime,
        scrapeStartDate: startDateStr,
        scrapeEndDate: endDateStr,
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
        alias,
        success: false,
        accountsFound: scrapeResult.accounts.length,
        transactionsAdded: 0,
        transactionsUpdated: 0,
        error: safeError,
        durationMs: Date.now() - startTime,
        scrapeStartDate: startDateStr,
        scrapeEndDate: endDateStr,
      };
    }

    onProgress?.(alias, "processing");

    // Process accounts and transactions inside a DB transaction for atomicity
    const db = getDatabase();
    let totalAdded = 0;
    let totalUpdated = 0;

    db.run("BEGIN");
    try {
      for (const acct of scrapeResult.accounts) {
        // Skip accounts the user has excluded from syncing
        if (isAccountExcludedByKey(companyId, acct.accountNumber)) {
          continue;
        }

        const account = upsertAccount(
          provider.id,
          acct.accountNumber,
          companyId,
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

          const txInput: TransactionInput = {
            accountId: account.id,
            type: mapTransactionType(tx.type),
            identifier: tx.identifier ?? null,
            date: tx.date,
            processedDate: tx.processedDate ?? tx.date,
            originalAmount: tx.originalAmount ?? tx.chargedAmount,
            originalCurrency: normalizeCurrency(tx.originalCurrency ?? "ILS"),
            chargedAmount: tx.chargedAmount,
            chargedCurrency: tx.chargedCurrency ? normalizeCurrency(tx.chargedCurrency) : null,
            description: tx.description ?? "",
            descriptionEn: null,
            memo: tx.memo ?? null,
            status: mapTransactionStatus(tx.status),
            installmentNumber: tx.installments?.number ?? null,
            installmentTotal: tx.installments?.total ?? null,
            category: tx.category ?? null,
            hash,
            uniqueId,
          };

          const result = upsertTransaction(txInput);
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
      alias,
      success: true,
      accountsFound: scrapeResult.accounts.length,
      transactionsAdded: totalAdded,
      transactionsUpdated: totalUpdated,
      durationMs: Date.now() - startTime,
      scrapeStartDate: startDateStr,
      scrapeEndDate: endDateStr,
    };
  } finally {
    // Zero credential values to minimize exposure window
    for (const key of Object.keys(credentials)) {
      credentials[key] = "";
    }
  }
}

function computeStartDate(
  providerId: number,
  companyId: string,
  config: AppConfig,
): Date {
  const lastSync = getLastSuccessfulSync(providerId);
  if (lastSync) {
    // Go back syncOverlapDays from when the last sync completed to catch late-posting transactions
    const referenceDate = lastSync.completedAt
      ? parseISO(lastSync.completedAt)
      : parseISO(lastSync.scrapeStartDate);
    return subDays(referenceDate, config.syncOverlapDays);
  }
  // First sync: go back as far as the scraper allows to maximize initial data
  const maxDays = isValidCompanyId(companyId)
    ? getScraperMaxDays(companyId)
    : config.initialSyncDays;
  return subDays(new Date(), maxDays);
}
