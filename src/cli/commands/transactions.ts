/**
 * kolshek transactions — List, search, and export transactions.
 */

import type { Command } from "commander";
import { resolve, relative } from "path";
import {
  listTransactions,
  searchTransactions,
  countTransactions,
  deleteTransaction,
} from "../../db/repositories/transactions.js";
import { CC_BILLING_CATEGORY, type TransactionWithContext } from "../../types/index.js";
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
import { buildFilters } from "../filter-utils.js";

/** Format a transaction row for the table */
function txRow(tx: TransactionWithContext, masked: boolean): string[] {
  const installment = formatInstallments(
    tx.installmentNumber,
    tx.installmentTotal,
  );
  const displayDesc = tx.descriptionEn ?? tx.description;
  const ccTag = tx.category === CC_BILLING_CATEGORY ? " [CC]" : "";
  const desc = installment
    ? `${displayDesc} ${installment}${ccTag}`
    : `${displayDesc}${ccTag}`;

  return [
    formatDate(tx.date),
    desc.length > 40 ? desc.slice(0, 37) + "..." : desc,
    formatCurrency(tx.chargedAmount, tx.chargedCurrency ?? "ILS"),
    tx.status === "pending" ? "pending" : "",
    tx.providerAlias,
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
    descriptionEn: tx.descriptionEn ?? null,
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
    providerAlias: tx.providerAlias,
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

  // --- transactions delete ---
  txCmd
    .command("delete <id>")
    .description(
      "Delete a transaction by ID. Use only for duplicates or erroneous records.",
    )
    .option("--yes", "Skip confirmation prompt")
    .action(async (idStr: string) => {
      const id = parseInt(idStr, 10);
      if (isNaN(id) || id <= 0) {
        printError("BAD_ARGS", "Transaction ID must be a positive integer");
        process.exit(ExitCode.BadArgs);
      }

      const result = deleteTransaction(id);

      if (!result.deleted) {
        printError("NOT_FOUND", `No transaction with ID ${id}`);
        process.exit(ExitCode.Error);
      }

      if (isJsonMode()) {
        printJson(jsonSuccess({ deletedId: id, transaction: result.transaction }));
        return;
      }

      info(
        `Deleted transaction #${id}: ${result.transaction!.description} (${formatCurrency(result.transaction!.chargedAmount)})`,
      );
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
          "description_en",
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
          "provider_alias",
          "account_number",
        ];
        const rows = txns.map((tx) =>
          [
            tx.date,
            tx.processedDate,
            csvEscape(tx.description),
            csvEscape(tx.descriptionEn ?? ""),
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
            csvEscape(tx.providerAlias),
            csvEscape(tx.accountNumber),
          ].join(","),
        );
        output = [headers.join(","), ...rows].join("\n");
      }

      if (opts.output) {
        const resolved = resolve(opts.output);
        const rel = relative(process.cwd(), resolved);
        if (rel.startsWith("..")) {
          printError("BAD_ARGS", "Output path must be within the current working directory", {
            suggestions: ["Use a relative path like './export.csv' or an absolute path inside cwd"],
          });
          process.exit(ExitCode.BadArgs);
        }
        await Bun.write(resolved, output);
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
