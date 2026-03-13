// kolshek trends — Multi-month cashflow and category trend analysis.

import type { Command } from "commander";
import { subMonths } from "date-fns";
import {
  getTotalTrends,
  getCategoryTrends,
  getFixedVariableTrends,
} from "../../db/repositories/trends.js";
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

type TrendMode = "total" | "category" | "fixed-variable";
const VALID_MODES = new Set<string>(["total", "category", "fixed-variable"]);

function buildMonthRange(months: number): DateRange {
  const from = subMonths(new Date(), months);
  return { from: from.toISOString().slice(0, 10) };
}

export function registerTrendsCommand(program: Command): void {
  program
    .command("trends [months]")
    .description("Multi-month cashflow and spending trend analysis")
    .option("--mode <mode>", "Analysis mode: total (default), category, fixed-variable", "total")
    .option("--category <name>", "Track specific category (implies --mode category)")
    .option("--type <type>", "Filter by provider type (bank|credit_card)")
    .action((monthsArg: string | undefined, opts) => {
      const monthCount = monthsArg ? parseInt(monthsArg, 10) : 6;
      if (isNaN(monthCount) || monthCount < 1) {
        printError("BAD_ARGS", "months must be a positive number");
        process.exit(ExitCode.BadArgs);
      }

      let mode: TrendMode = opts.mode;
      if (opts.category) mode = "category";

      if (!VALID_MODES.has(mode)) {
        printError("BAD_ARGS", `Invalid mode: ${mode}. Use: total, category, fixed-variable`);
        process.exit(ExitCode.BadArgs);
      }

      if (mode === "category" && !opts.category) {
        printError("BAD_ARGS", "--category is required for category mode");
        process.exit(ExitCode.BadArgs);
      }

      const range = buildMonthRange(monthCount);

      if (mode === "total") {
        const trends = getTotalTrends(range, opts.type);
        if (isJsonMode()) {
          printJson(jsonSuccess({ mode, months: monthCount, trends }));
          return;
        }
        if (trends.length === 0) { info("No data in the selected range."); return; }

        const table = createTable(
          ["Month", "Income", "Expenses", "Net", "Exp %", "Inc %"],
          trends.map((t) => [
            t.month,
            formatCurrency(t.income),
            formatCurrency(-(t.bankExpenses + t.ccExpenses)),
            formatCurrency(t.net),
            t.expenseChange != null ? `${t.expenseChange > 0 ? "+" : ""}${t.expenseChange}%` : "—",
            t.incomeChange != null ? `${t.incomeChange > 0 ? "+" : ""}${t.incomeChange}%` : "—",
          ]),
        );
        console.log(table);
        info(`\n${trends.length} month(s) of trends.`);
      } else if (mode === "category") {
        const trends = getCategoryTrends(range, opts.category, opts.type);
        if (isJsonMode()) {
          printJson(jsonSuccess({ mode, category: opts.category, months: monthCount, trends }));
          return;
        }
        if (trends.length === 0) { info(`No data for "${opts.category}" in the selected range.`); return; }

        const table = createTable(
          ["Month", "Amount", "Txns", "Change %"],
          trends.map((t) => [
            t.month,
            formatCurrency(-t.totalAmount),
            String(t.transactionCount),
            t.change != null ? `${t.change > 0 ? "+" : ""}${t.change}%` : "—",
          ]),
        );
        console.log(table);
        info(`\n"${opts.category}" over ${trends.length} month(s).`);
      } else {
        const trends = getFixedVariableTrends(range, opts.type);
        if (isJsonMode()) {
          printJson(jsonSuccess({ mode, months: monthCount, trends }));
          return;
        }
        if (trends.length === 0) { info("No data in the selected range."); return; }

        const table = createTable(
          ["Month", "Fixed", "Variable", "Fixed %", "Fixed Merchants"],
          trends.map((t) => [
            t.month,
            formatCurrency(-t.fixed),
            formatCurrency(-t.variable),
            `${t.fixedPercent}%`,
            String(t.fixedMerchants),
          ]),
        );
        console.log(table);
        info(`\n${trends.length} month(s) — fixed = same merchant, similar amount, 3+ months.`);
      }
    });
}
