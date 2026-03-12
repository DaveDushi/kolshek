/**
 * kolshek reports — Preset financial analysis for AI agents.
 */

import type { Command } from "commander";
import { subDays } from "date-fns";
import { parseDateToString } from "../date-utils.js";
import {
  getMonthlyReport,
  getCategoryReport,
  getMerchantReport,
  getBalanceReport,
} from "../../db/repositories/reports.js";
import type { DateRange } from "../../db/repositories/reports.js";
import {
  isJsonMode,
  printJson,
  jsonSuccess,
  printError,
  info,
  createTable,
  formatCurrency,
  ExitCode,
} from "../output.js";

/** Parse --from/--to opts into a DateRange, defaulting to last 90 days */
function buildDateRange(opts: Record<string, unknown>): DateRange {
  const range: DateRange = {};

  if (opts.from) {
    const d = parseDateToString(String(opts.from));
    if (!d) {
      printError("BAD_DATE", `Invalid --from date: ${opts.from}`);
      process.exit(ExitCode.BadArgs);
    }
    range.from = d;
  } else {
    // Default: 90 days ago
    range.from = subDays(new Date(), 90).toISOString().slice(0, 10);
  }

  if (opts.to) {
    const d = parseDateToString(String(opts.to));
    if (!d) {
      printError("BAD_DATE", `Invalid --to date: ${opts.to}`);
      process.exit(ExitCode.BadArgs);
    }
    range.to = d;
  }

  return range;
}

export function registerReportsCommand(program: Command): void {
  const reportsCmd = program
    .command("reports")
    .alias("report")
    .description("Financial analysis reports");

  // --- reports monthly ---
  reportsCmd
    .command("monthly")
    .description("Monthly income/expenses/net breakdown")
    .option("--from <date>", "Start date")
    .option("--to <date>", "End date")
    .option("--type <type>", "Filter by provider type (bank|credit_card)")
    .action((opts) => {
      const range = buildDateRange(opts);
      const months = getMonthlyReport(range, opts.type);

      const totals = months.reduce(
        (acc, m) => ({
          income: acc.income + m.income,
          bankExpenses: acc.bankExpenses + m.bankExpenses,
          ccExpenses: acc.ccExpenses + m.ccExpenses,
          ccCharge: acc.ccCharge + m.ccCharge,
          net: acc.net + m.net,
        }),
        { income: 0, bankExpenses: 0, ccExpenses: 0, ccCharge: 0, net: 0 },
      );

      if (isJsonMode()) {
        printJson(jsonSuccess({ months, totals, range }));
        return;
      }

      if (months.length === 0) {
        info("No transactions in the selected range.");
        return;
      }

      const table = createTable(
        ["Month", "Income", "Bank Exp.", "CC Exp.", "CC Charge", "Net", "Txns"],
        months.map((m) => [
          m.month,
          formatCurrency(m.income),
          formatCurrency(-m.bankExpenses),
          formatCurrency(-m.ccExpenses),
          formatCurrency(-m.ccCharge),
          formatCurrency(m.net),
          String(m.transactionCount),
        ]),
      );
      console.log(table);
      info(
        `\nTotals — Income: ${formatCurrency(totals.income)}, Bank Exp: ${formatCurrency(-totals.bankExpenses)}, CC Exp: ${formatCurrency(-totals.ccExpenses)}, CC Charge: ${formatCurrency(-totals.ccCharge)}, Net: ${formatCurrency(totals.net)}`,
      );
    });

  // --- reports categories ---
  reportsCmd
    .command("categories")
    .description("Expense breakdown by category")
    .option("--from <date>", "Start date")
    .option("--to <date>", "End date")
    .option("--type <type>", "Filter by provider type (bank|credit_card)")
    .action((opts) => {
      const range = buildDateRange(opts);
      const categories = getCategoryReport(range, opts.type);
      const totalSpend = categories.reduce(
        (sum, c) => sum + c.totalAmount,
        0,
      );

      if (isJsonMode()) {
        printJson(jsonSuccess({ categories, totalSpend, range }));
        return;
      }

      if (categories.length === 0) {
        info("No expenses in the selected range.");
        return;
      }

      const table = createTable(
        ["Category", "Amount", "Transactions", "%"],
        categories.map((c) => [
          c.category,
          formatCurrency(-c.totalAmount),
          String(c.transactionCount),
          `${c.percentage}%`,
        ]),
      );
      console.log(table);
      info(`\nTotal spend: ${formatCurrency(-totalSpend)}`);
    });

  // --- reports merchants ---
  reportsCmd
    .command("merchants")
    .description("Top merchants by spend")
    .option("--from <date>", "Start date")
    .option("--to <date>", "End date")
    .option("--type <type>", "Filter by provider type (bank|credit_card)")
    .option("--limit <n>", "Number of merchants to show", parseInt, 20)
    .action((opts) => {
      const range = buildDateRange(opts);
      const limit = opts.limit ?? 20;
      const merchants = getMerchantReport(range, limit, opts.type);

      if (isJsonMode()) {
        printJson(jsonSuccess({ merchants, range, limit }));
        return;
      }

      if (merchants.length === 0) {
        info("No expenses in the selected range.");
        return;
      }

      const table = createTable(
        ["Merchant", "Total", "Transactions", "Average"],
        merchants.map((m) => [
          m.merchant.length > 35
            ? m.merchant.slice(0, 32) + "..."
            : m.merchant,
          formatCurrency(-m.totalAmount),
          String(m.transactionCount),
          formatCurrency(-m.averageAmount),
        ]),
      );
      console.log(table);
      info(`\nTop ${merchants.length} merchant(s) by spend.`);
    });

  // --- reports balance ---
  reportsCmd
    .command("balance")
    .description("Account balances with 30-day activity summary")
    .action(() => {
      const accounts = getBalanceReport();

      if (isJsonMode()) {
        const totalBalance = accounts.reduce(
          (sum, a) => sum + (a.balance ?? 0),
          0,
        );
        printJson(jsonSuccess({ accounts, totalBalance }));
        return;
      }

      if (accounts.length === 0) {
        info("No accounts found.");
        return;
      }

      const table = createTable(
        [
          "Provider",
          "Type",
          "Account",
          "Balance",
          "30d Expenses",
          "30d Income",
        ],
        accounts.map((a) => [
          a.providerAlias,
          a.providerType,
          a.accountNumber,
          a.balance != null ? formatCurrency(a.balance, a.currency) : "N/A",
          formatCurrency(-a.recentExpenses30d, a.currency),
          formatCurrency(a.recentIncome30d, a.currency),
        ]),
      );
      console.log(table);

      const totalBalance = accounts.reduce(
        (sum, a) => sum + (a.balance ?? 0),
        0,
      );
      info(`\nTotal balance: ${formatCurrency(totalBalance)}`);
    });
}
