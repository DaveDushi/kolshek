/**
 * kolshek transactions — List, search, and export transactions.
 */

import type { Command } from "commander";
import { parseISO, subDays, isValid } from "date-fns";
import {
  listTransactions,
  searchTransactions,
  countTransactions,
} from "../../db/repositories/transactions.js";
import { getProviderByCompanyId } from "../../db/repositories/providers.js";
import type {
  TransactionFilters,
  TransactionStatus,
  TransactionWithContext,
} from "../../types/index.js";
import {
  isJsonMode,
  printJson,
  jsonSuccess,
  printError,
  info,
  createTable,
  formatCurrency,
  formatDate,
  formatAccountNumber,
  formatInstallments,
  ExitCode,
} from "../output.js";

/** Parse a date string: YYYY-MM-DD, DD/MM/YYYY, or relative like "30d" */
function parseDate(input: string): string | null {
  const relMatch = input.match(/^(\d+)d$/);
  if (relMatch) {
    return subDays(new Date(), Number(relMatch[1])).toISOString().slice(0, 10);
  }
  const ddmmyyyy = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const day = Number(ddmmyyyy[1]);
    const month = Number(ddmmyyyy[2]) - 1;
    const year = Number(ddmmyyyy[3]);
    const d = new Date(Date.UTC(year, month, day));
    // Validate components match to reject invalid dates like 32/01/2025
    if (isValid(d) && d.getUTCFullYear() === year && d.getUTCMonth() === month && d.getUTCDate() === day) {
      return d.toISOString().slice(0, 10);
    }
  }
  const iso = parseISO(input);
  if (isValid(iso)) return input;
  return null;
}

/** Build TransactionFilters from CLI options */
function buildFilters(opts: Record<string, unknown>): TransactionFilters {
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

/** Format a transaction row for the table */
function txRow(tx: TransactionWithContext, masked: boolean): string[] {
  const installment = formatInstallments(
    tx.installmentNumber,
    tx.installmentTotal,
  );
  const desc = installment
    ? `${tx.description} ${installment}`
    : tx.description;

  return [
    formatDate(tx.date),
    desc.length > 40 ? desc.slice(0, 37) + "..." : desc,
    formatCurrency(tx.chargedAmount, tx.chargedCurrency ?? "ILS"),
    tx.status === "pending" ? "pending" : "",
    tx.providerDisplayName,
    formatAccountNumber(tx.accountNumber, masked),
  ];
}

/** Serialize a transaction for JSON output (full data, no masking) */
function txToJson(tx: TransactionWithContext): Record<string, unknown> {
  return {
    id: tx.id,
    date: tx.date,
    processedDate: tx.processedDate,
    description: tx.description,
    type: tx.type,
    identifier: tx.identifier,
    originalAmount: tx.originalAmount,
    originalCurrency: tx.originalCurrency,
    chargedAmount: tx.chargedAmount,
    chargedCurrency: tx.chargedCurrency,
    status: tx.status,
    memo: tx.memo,
    category: tx.category,
    installmentNumber: tx.installmentNumber,
    installmentTotal: tx.installmentTotal,
    provider: tx.providerCompanyId,
    providerName: tx.providerDisplayName,
    accountNumber: tx.accountNumber,
  };
}

export function registerTransactionsCommand(program: Command): void {
  const txCmd = program
    .command("transactions")
    .alias("tx")
    .description("List, search, and export transactions");

  // --- transactions list ---
  txCmd
    .command("list")
    .description("List transactions with filters")
    .option("--from <date>", "Start date")
    .option("--to <date>", "End date")
    .option("--provider <name>", "Filter by provider company ID")
    .option("--type <type>", "Filter by provider type (bank|credit_card)")
    .option("--account <number>", "Filter by account number")
    .option("--min <amount>", "Minimum charged amount", parseFloat)
    .option("--max <amount>", "Maximum charged amount", parseFloat)
    .option("--status <status>", "Filter by status (pending|completed)")
    .option("--sort <field>", "Sort by date or amount", "date")
    .option("--limit <n>", "Maximum rows to return", parseInt)
    .action((opts) => {
      const filters = buildFilters(opts);
      const txns = listTransactions(filters);

      if (isJsonMode()) {
        const count = countTransactions(filters);
        printJson(
          jsonSuccess({
            transactions: txns.map(txToJson),
            count: txns.length,
            total: count,
          }),
        );
        return;
      }

      if (txns.length === 0) {
        info("No transactions found.");
        return;
      }

      const table = createTable(
        ["Date", "Description", "Amount", "Status", "Provider", "Account"],
        txns.map((tx) => txRow(tx, true)),
      );
      console.log(table);
      info(`\nShowing ${txns.length} transaction(s).`);
    });

  // --- transactions search ---
  txCmd
    .command("search <query>")
    .description("Search transactions by description")
    .option("--from <date>", "Start date")
    .option("--to <date>", "End date")
    .option("--provider <name>", "Filter by provider")
    .option("--limit <n>", "Maximum results", parseInt)
    .action((query: string, opts) => {
      const filters = buildFilters(opts);
      const txns = searchTransactions(query, filters);

      if (isJsonMode()) {
        printJson(
          jsonSuccess({
            query,
            transactions: txns.map(txToJson),
            count: txns.length,
          }),
        );
        return;
      }

      if (txns.length === 0) {
        info(`No transactions matching "${query}".`);
        return;
      }

      const table = createTable(
        ["Date", "Description", "Amount", "Status", "Provider", "Account"],
        txns.map((tx) => txRow(tx, true)),
      );
      console.log(table);
      info(`\n${txns.length} result(s) for "${query}".`);
    });

  // --- transactions export ---
  txCmd
    .command("export <format>")
    .description("Export transactions to CSV or JSON")
    .option("--from <date>", "Start date")
    .option("--to <date>", "End date")
    .option("--provider <name>", "Filter by provider")
    .option("--type <type>", "Filter by provider type")
    .option("--output <path>", "Write to file instead of stdout")
    .action(async (format: string, opts) => {
      if (format !== "csv" && format !== "json") {
        printError("BAD_ARGS", "Format must be 'csv' or 'json'");
        process.exit(ExitCode.BadArgs);
      }

      const filters = buildFilters(opts);
      // No limit for export
      filters.limit = undefined;
      const txns = listTransactions(filters);

      let output: string;

      if (format === "json") {
        output = JSON.stringify(txns.map(txToJson), null, 2);
      } else {
        // CSV
        const headers = [
          "date",
          "processed_date",
          "description",
          "charged_amount",
          "charged_currency",
          "original_amount",
          "original_currency",
          "status",
          "type",
          "identifier",
          "memo",
          "category",
          "installment_number",
          "installment_total",
          "provider",
          "account_number",
        ];
        const rows = txns.map((tx) =>
          [
            tx.date,
            tx.processedDate,
            csvEscape(tx.description),
            String(tx.chargedAmount),
            csvEscape(tx.chargedCurrency ?? "ILS"),
            String(tx.originalAmount),
            csvEscape(tx.originalCurrency),
            tx.status,
            tx.type,
            csvEscape(tx.identifier ?? ""),
            csvEscape(tx.memo ?? ""),
            csvEscape(tx.category ?? ""),
            tx.installmentNumber != null ? String(tx.installmentNumber) : "",
            tx.installmentTotal != null ? String(tx.installmentTotal) : "",
            csvEscape(tx.providerCompanyId),
            csvEscape(tx.accountNumber),
          ].join(","),
        );
        output = [headers.join(","), ...rows].join("\n");
      }

      if (opts.output) {
        await Bun.write(opts.output, output);
        if (!isJsonMode()) {
          info(`Exported ${txns.length} transactions to ${opts.output}`);
        }
      } else {
        console.log(output);
      }

      if (isJsonMode() && opts.output) {
        printJson(
          jsonSuccess({
            exported: txns.length,
            format,
            path: opts.output,
          }),
        );
      }
    });
}

function csvEscape(value: string): string {
  // Strip newlines to prevent formula injection in subsequent lines within a cell
  value = value.replace(/[\r\n]+/g, " ");
  // Prevent formula injection in spreadsheet applications
  if (/^[=+\-@\t;]/.test(value)) {
    value = "'" + value;
  }
  if (value.includes(",") || value.includes('"') || value.includes("'")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
