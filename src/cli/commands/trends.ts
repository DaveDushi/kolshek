// kolshek trends — Multi-month cashflow and category trend analysis.

import type { Command } from "commander";
import {
  getTotalTrendData,
  getCategoryTrendData,
  getFixedVariableTrendData,
} from "../../services/trends.js";
import { addClassificationOptions, parseClassificationFlags } from "../filter-utils.js";
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

export function registerTrendsCommand(program: Command): void {
  const cmd = program
    .command("trends [months]")
    .description("Multi-month cashflow and spending trend analysis")
    .option("--mode <mode>", "Analysis mode: total (default), category, fixed-variable", "total")
    .option("--category <name>", "Track specific category (implies --mode category)")
    .option("--type <type>", "Filter by provider type (bank|credit_card)");

  addClassificationOptions(cmd);

  cmd.action((monthsArg: string | undefined, opts) => {
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

    const { excludeClassifications } = parseClassificationFlags(opts);
    const trendOpts = { months: monthCount, providerType: opts.type, excludeClassifications };

    if (mode === "total") {
      const trends = getTotalTrendData(trendOpts);
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
          formatCurrency(-t.expenses),
          formatCurrency(t.net),
          t.expenseChange != null ? `${t.expenseChange > 0 ? "+" : ""}${t.expenseChange}%` : "—",
          t.incomeChange != null ? `${t.incomeChange > 0 ? "+" : ""}${t.incomeChange}%` : "—",
        ]),
      );
      console.log(table);
      info(`\n${trends.length} month(s) of trends.`);
    } else if (mode === "category") {
      const trends = getCategoryTrendData(opts.category, trendOpts);
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
      const trends = getFixedVariableTrendData(trendOpts);
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
