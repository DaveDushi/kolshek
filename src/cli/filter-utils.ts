// Shared CLI filter-building utilities.

import type { Command } from "commander";
import type { TransactionFilters, TransactionStatus } from "../types/index.js";
import { isValidClassification } from "../types/index.js";
import { resolveProviders } from "../db/repositories/providers.js";
import { printError, ExitCode } from "./output.js";
import { parseDateToString as parseDate } from "./date-utils.js";

// Add --exclude and --include classification flags to a commander Command.
export function addClassificationOptions(cmd: Command): Command {
  return cmd
    .option("--exclude <classifications>", "Comma-separated classifications to exclude (e.g., cc_billing,transfer)")
    .option("--include <classifications>", "Only include these classifications (mutually exclusive with --exclude)");
}

// Parse --exclude / --include flags into excludeClassifications array.
// Returns undefined if neither flag is set (let the repository use its default).
export function parseClassificationFlags(
  opts: Record<string, unknown>,
): { excludeClassifications?: string[]; includeClassifications?: string[] } {
  const result: { excludeClassifications?: string[]; includeClassifications?: string[] } = {};

  if (opts.exclude && opts.include) {
    printError("BAD_ARGS", "--exclude and --include are mutually exclusive");
    process.exit(ExitCode.BadArgs);
  }

  if (opts.exclude) {
    const values = String(opts.exclude).split(",").map((s) => s.trim()).filter(Boolean);
    for (const v of values) {
      if (!isValidClassification(v)) {
        printError("BAD_ARGS", `Invalid classification: "${v}". Must be lowercase alphanumeric with underscores.`);
        process.exit(ExitCode.BadArgs);
      }
    }
    result.excludeClassifications = values;
  }

  if (opts.include) {
    const values = String(opts.include).split(",").map((s) => s.trim()).filter(Boolean);
    for (const v of values) {
      if (!isValidClassification(v)) {
        printError("BAD_ARGS", `Invalid classification: "${v}". Must be lowercase alphanumeric with underscores.`);
        process.exit(ExitCode.BadArgs);
      }
    }
    result.includeClassifications = values;
  }

  return result;
}

/** Build TransactionFilters from CLI options */
export function buildFilters(opts: Record<string, unknown>): TransactionFilters {
  const filters: TransactionFilters = {};

  if (opts.from) {
    const d = parseDate(String(opts.from));
    if (!d) {
      printError("BAD_DATE", `Invalid --from date: ${opts.from}`);
      process.exit(ExitCode.BadArgs);
    }
    filters.from = d;
  }
  if (opts.to) {
    const d = parseDate(String(opts.to));
    if (!d) {
      printError("BAD_DATE", `Invalid --to date: ${opts.to}`);
      process.exit(ExitCode.BadArgs);
    }
    filters.to = d;
  }
  if (opts.provider) {
    const resolved = resolveProviders(String(opts.provider));
    if (resolved.length === 1) {
      filters.providerId = resolved[0].id;
    } else if (resolved.length > 1) {
      filters.providerCompanyId = resolved[0].companyId;
    } else {
      filters.providerCompanyId = String(opts.provider);
    }
  }
  if (opts.type) {
    filters.providerType = String(opts.type) as "bank" | "credit_card";
  }
  if (opts.account) {
    filters.accountNumber = String(opts.account);
  }
  if (opts.min !== undefined) {
    filters.minAmount = Number(opts.min);
  }
  if (opts.max !== undefined) {
    filters.maxAmount = Number(opts.max);
  }
  if (opts.status) {
    filters.status = String(opts.status) as TransactionStatus;
  }
  if (opts.sort) {
    filters.sort = String(opts.sort) as "date" | "amount";
  }
  filters.sortDirection = "desc";
  if (opts.limit) {
    filters.limit = Number(opts.limit);
  }

  return filters;
}
