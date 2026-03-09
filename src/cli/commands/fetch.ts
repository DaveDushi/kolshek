/**
 * kolshek fetch — Fetch transactions from providers.
 */

import type { Command } from "commander";
import { listProviders, resolveProviders } from "../../db/repositories/providers.js";
import { syncProviders } from "../../core/sync-engine.js";
import { applyCategoryRules } from "../../db/repositories/categories.js";
import { applyTranslationRules } from "../../db/repositories/translations.js";
import { loadConfig } from "../../config/loader.js";
import type { ProviderType, SyncResult } from "../../types/index.js";
import {
  isJsonMode,
  printJson,
  jsonSuccess,
  printError,
  success,
  info,
  warn,
  createTable,
  createSpinner,
  ExitCode,
} from "../output.js";
import { parseDateToDate as parseDate } from "../date-utils.js";

export interface FetchOptions {
  providers?: string[];
  from?: string;
  to?: string;
  force?: boolean;
  type?: ProviderType;
  stealth?: boolean;
  visible?: boolean;
}

/**
 * Run the fetch operation. Exported for use by init command.
 */
export async function runFetch(opts: FetchOptions = {}): Promise<void> {
  const config = await loadConfig();
  const allProviders = listProviders();

  if (allProviders.length === 0) {
    printError("NO_PROVIDERS", "No providers configured", {
      suggestions: [
        'Run "kolshek init" or "kolshek providers add" first',
      ],
    });
    process.exit(ExitCode.Error);
  }

  // Filter providers — resolve each identifier via alias/companyId/ID
  let targetProviders = allProviders;
  if (opts.providers?.length) {
    const resolved = new Map<number, typeof allProviders[0]>();
    for (const identifier of opts.providers) {
      for (const p of resolveProviders(identifier)) {
        resolved.set(p.id, p);
      }
    }
    targetProviders = [...resolved.values()];
    if (targetProviders.length === 0) {
      printError("NOT_FOUND", "No matching providers found", {
        suggestions: [
          'Run "kolshek providers list" to see configured providers',
        ],
      });
      process.exit(ExitCode.BadArgs);
    }
  }
  if (opts.type) {
    targetProviders = targetProviders.filter((p) => p.type === opts.type);
  }

  // Parse dates
  let fromDate: Date | undefined;
  if (opts.from) {
    fromDate = parseDate(opts.from) ?? undefined;
    if (!fromDate) {
      printError("BAD_DATE", `Invalid --from date: ${opts.from}`, {
        suggestions: ["Use YYYY-MM-DD, DD/MM/YYYY, or relative like '30d'"],
      });
      process.exit(ExitCode.BadArgs);
    }
  }

  let toDate: Date | undefined;
  if (opts.to) {
    toDate = parseDate(opts.to) ?? undefined;
    if (!toDate) {
      printError("BAD_DATE", `Invalid --to date: ${opts.to}`, {
        suggestions: ["Use YYYY-MM-DD, DD/MM/YYYY, or relative like '30d'"],
      });
      process.exit(ExitCode.BadArgs);
    }
  }

  // Warn about DEBUG logging that may expose PII
  if (process.env.DEBUG) {
    warn("DEBUG env var is set — upstream scrapers may log sensitive data (credentials, account numbers) to stderr.");
  }

  // Run sync
  const spinner = createSpinner(
    `Fetching from ${targetProviders.length} provider(s)...`,
  );
  spinner.start();

  let result: SyncResult;
  try {
    result = await syncProviders(
      targetProviders,
      {
        fromDate,
        toDate,
        force: opts.force,
        stealth: opts.stealth,
        visible: opts.visible,
        config,
      },
    );
  } catch (err) {
    spinner.fail("Fetch failed");
    printError("SYNC_ERROR", err instanceof Error ? err.message : String(err), {
      retryable: true,
    });
    process.exit(ExitCode.Error);
  }

  spinner.stop();

  // Auto-apply translation rules then category rules after successful sync
  if (!result.hasErrors || result.totalAdded > 0) {
    const transResult = applyTranslationRules();
    if (!isJsonMode() && transResult.applied > 0) {
      info(`Translated ${transResult.applied} transaction(s).`);
    }

    const catResult = applyCategoryRules();
    if (!isJsonMode() && catResult.applied > 0) {
      info(`Categorized ${catResult.applied} transaction(s).`);
    }
  }

  // Output results
  if (isJsonMode()) {
    printJson(jsonSuccess(result));
    process.exit(
      result.hasErrors ? ExitCode.PartialSuccess : ExitCode.Success,
    );
  }

  // Human output
  const rows = result.results.map((r) => {
    const range = r.scrapeStartDate && r.scrapeEndDate
      ? `${r.scrapeStartDate} → ${r.scrapeEndDate}`
      : "";
    return [
      r.companyId,
      r.success ? "✓" : "✗",
      range,
      String(r.transactionsAdded),
      String(r.transactionsUpdated),
      r.error ?? "",
      `${(r.durationMs / 1000).toFixed(1)}s`,
    ];
  });

  const table = createTable(
    ["Provider", "Status", "Range", "Added", "Updated", "Error", "Duration"],
    rows,
  );
  console.log(table);
  console.log("");

  if (result.hasErrors) {
    info(
      `Partial success: ${result.totalAdded} added, ${result.totalUpdated} updated (some providers failed).`,
    );
    process.exit(ExitCode.PartialSuccess);
  } else {
    success(
      `Done: ${result.totalAdded} transactions added, ${result.totalUpdated} updated.`,
    );
  }
}

export function registerFetchCommand(program: Command): void {
  program
    .command("fetch [providers...]")
    .description("Fetch transactions from all or specific providers")
    .option("--from <date>", "Start date (YYYY-MM-DD, DD/MM/YYYY, or 30d)")
    .option("--to <date>", "End date")
    .option("--force", "Re-fetch even if recently synced", false)
    .option("--type <type>", "Fetch only banks or credit cards")
    .option("--stealth", "Use stealth browser to avoid bot detection", false)
    .option("--visible", "Show the browser window (helps bypass bot detection)", false)
    .action(async (providers: string[], opts) => {
      await runFetch({
        providers: providers.length > 0 ? providers : undefined,
        from: opts.from,
        to: opts.to,
        force: opts.force,
        type: opts.type,
        stealth: opts.stealth,
        visible: opts.visible,
      });
    });
}
