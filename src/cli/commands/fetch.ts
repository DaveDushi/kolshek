/**
 * kolshek fetch — Fetch transactions from providers.
 */

import type { Command } from "commander";
import { parseISO, subDays, isValid } from "date-fns";
import { listProviders } from "../../db/repositories/providers.js";
import { syncProviders } from "../../core/sync-engine.js";
import { loadConfig } from "../../config/loader.js";
import type { ProviderType, SyncResult } from "../../types/index.js";
import {
  isJsonMode,
  printJson,
  jsonSuccess,
  printError,
  success,
  info,
  createTable,
  createSpinner,
  ExitCode,
} from "../output.js";

/** Parse a date string: YYYY-MM-DD, DD/MM/YYYY, or relative like "30d" */
function parseDate(input: string): Date | null {
  // Relative: "30d" = 30 days ago
  const relMatch = input.match(/^(\d+)d$/);
  if (relMatch) {
    return subDays(new Date(), Number(relMatch[1]));
  }

  // DD/MM/YYYY
  const ddmmyyyy = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const d = new Date(
      Number(ddmmyyyy[3]),
      Number(ddmmyyyy[2]) - 1,
      Number(ddmmyyyy[1]),
    );
    if (isValid(d)) return d;
  }

  // ISO YYYY-MM-DD
  const iso = parseISO(input);
  if (isValid(iso)) return iso;

  return null;
}

export interface FetchOptions {
  providers?: string[];
  from?: string;
  to?: string;
  force?: boolean;
  type?: ProviderType;
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

  // Filter providers
  let targetProviders = allProviders;
  if (opts.providers?.length) {
    targetProviders = allProviders.filter(
      (p) =>
        opts.providers!.includes(p.companyId) ||
        opts.providers!.includes(String(p.id)),
    );
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

  // Run sync
  const spinner = createSpinner(
    `Fetching from ${targetProviders.length} provider(s)...`,
  );
  spinner.start();

  let result: SyncResult;
  try {
    result = await syncProviders(
      targetProviders.map((p) => p.companyId),
      {
        fromDate,
        toDate,
        force: opts.force,
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

  // Output results
  if (isJsonMode()) {
    printJson(jsonSuccess(result));
    process.exit(
      result.hasErrors ? ExitCode.PartialSuccess : ExitCode.Success,
    );
  }

  // Human output
  const rows = result.results.map((r) => [
    r.companyId,
    r.success ? "✓" : "✗",
    String(r.transactionsAdded),
    String(r.transactionsUpdated),
    r.error ?? "",
    `${(r.durationMs / 1000).toFixed(1)}s`,
  ]);

  const table = createTable(
    ["Provider", "Status", "Added", "Updated", "Error", "Duration"],
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
    .action(async (providers: string[], opts) => {
      await runFetch({
        providers: providers.length > 0 ? providers : undefined,
        from: opts.from,
        to: opts.to,
        force: opts.force,
        type: opts.type,
      });
    });
}
