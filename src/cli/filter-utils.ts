/**
 * Shared CLI filter-building utilities.
 */

import type { TransactionFilters, TransactionStatus } from "../types/index.js";
import { getProviderByCompanyId } from "../db/repositories/providers.js";
import { printError, ExitCode } from "./output.js";
import { parseDateToString as parseDate } from "./date-utils.js";

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
    const p = getProviderByCompanyId(String(opts.provider));
    if (p) {
      filters.providerId = p.id;
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
