// kolshek spending — Unified spending view with grouping.

import type { Command } from "commander";
import { parseMonthToRange } from "../date-utils.js";
import { getSpendingReport, type SpendingGroupBy } from "../../db/repositories/spending.js";
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

const VALID_GROUP_BY = new Set(["category", "merchant", "provider"]);

export function registerSpendingCommand(program: Command): void {
  const spendingCmd = program
    .command("spending [month]")
    .description("Spending breakdown by category, merchant, or provider")
    .option("--group-by <field>", "Group by: category (default), merchant, provider", "category")
    .option("--category <name>", "Filter to a specific category")
    .option("--top <n>", "Limit to top N groups", parseInt)
    .option("--type <type>", "Filter by provider type (bank|credit_card)")
    .option("-m, --month-offset <n>", "Months ago (e.g., -m 3 for 3 months ago)", parseInt);

  addClassificationOptions(spendingCmd);

  spendingCmd.action((month: string | undefined, opts) => {
    if (opts.monthOffset) month = `-${opts.monthOffset}`;
    const groupBy = opts.groupBy as string;
    if (!VALID_GROUP_BY.has(groupBy)) {
      printError("BAD_ARGS", `Invalid --group-by value: ${groupBy}. Use: category, merchant, provider`);
      process.exit(ExitCode.BadArgs);
    }

    const range = parseMonthToRange(month);

    if (!range) {
      printError("BAD_ARGS", `Could not parse month: "${month}". Use YYYY-MM, "prev", "-3", or a date.`);
      process.exit(ExitCode.BadArgs);
    }

    const { excludeClassifications } = parseClassificationFlags(opts);

    const result = getSpendingReport({
      from: range.from,
      to: range.to,
      groupBy: groupBy as SpendingGroupBy,
      category: opts.category,
      providerType: opts.type,
      top: opts.top,
      excludeClassifications,
    });

    if (isJsonMode()) {
      printJson(jsonSuccess({
        month: range.label,
        groupBy,
        excludeClassifications: excludeClassifications ?? null,
        summary: result.summary,
        groups: result.groups,
      }));
      return;
    }

    if (result.groups.length === 0) {
      info(`No spending data for ${range.label}.`);
      return;
    }

    const groupLabel = groupBy.charAt(0).toUpperCase() + groupBy.slice(1);
    const table = createTable(
      [groupLabel, "Amount", "Txns", "%"],
      result.groups.map((g) => [
        g.label.length > 40 ? g.label.slice(0, 37) + "..." : g.label,
        formatCurrency(-g.totalAmount),
        String(g.transactionCount),
        `${g.percentage}%`,
      ]),
    );
    console.log(table);
    info(`\n${range.label} — Total: ${formatCurrency(-result.summary.totalExpenses)} | ${result.summary.transactionCount} txns | ${formatCurrency(-result.summary.avgPerDay)}/day`);
  });
}
