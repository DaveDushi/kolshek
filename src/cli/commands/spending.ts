// kolshek spending — Unified spending view with grouping.
// Includes `spending exclude` subcommands for managing non-spending categories.

import type { Command } from "commander";
import { parseMonthToRange } from "../date-utils.js";
import { getSpendingReport, type SpendingGroupBy } from "../../db/repositories/spending.js";
import {
  addSpendingExclude,
  removeSpendingExclude,
  listSpendingExcludes,
} from "../../db/repositories/spending-excludes.js";
import {
  isJsonMode,
  printJson,
  jsonSuccess,
  printError,
  success,
  info,
  warn,
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
    .option("--lifestyle", "Exclude categories marked as non-spending (transfers, settlements, etc.)")
    .option("-m, --month-offset <n>", "Months ago (e.g., -m 3 for 3 months ago)", parseInt)
    .action((month: string | undefined, opts) => {
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

      // Hint if --lifestyle is used but no exclusions are configured
      if (opts.lifestyle && !isJsonMode()) {
        const excludes = listSpendingExcludes();
        if (excludes.length === 0) {
          info("Tip: no categories excluded yet. Add some with `kolshek spending exclude add <category>`");
        }
      }

      const result = getSpendingReport({
        from: range.from,
        to: range.to,
        groupBy: groupBy as SpendingGroupBy,
        category: opts.category,
        providerType: opts.type,
        top: opts.top,
        lifestyle: opts.lifestyle ?? false,
      });

      if (isJsonMode()) {
        printJson(jsonSuccess({
          month: range.label,
          groupBy,
          lifestyle: !!opts.lifestyle,
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
      const modeLabel = opts.lifestyle ? " (lifestyle)" : "";
      info(`\n${range.label}${modeLabel} — Total: ${formatCurrency(-result.summary.totalExpenses)} | ${result.summary.transactionCount} txns | ${formatCurrency(-result.summary.avgPerDay)}/day`);
    });

  // --- spending exclude --- manage non-spending categories
  const excludeCmd = spendingCmd
    .command("exclude")
    .description("Manage categories excluded from lifestyle spending view")
    .addHelpText("after", `
Some categories represent financial mechanics, not real spending — transfers
between your accounts, CC settlements, investment moves, bank fees.

Mark them as excluded so \`kolshek spending --lifestyle\` shows what you
actually spent on goods and services.

Examples:
  kolshek spending exclude add "Transfers"
  kolshek spending exclude add "Investment / Savings"
  kolshek spending exclude list
  kolshek spending exclude remove "Bank & Card Fees"
`);

  excludeCmd
    .command("add <category>")
    .description("Mark a category as non-spending")
    .action((category: string) => {
      const { created } = addSpendingExclude(category);

      if (isJsonMode()) {
        printJson(jsonSuccess({ category, created }));
        return;
      }

      if (created) {
        success(`"${category}" excluded from lifestyle spending.`);
      } else {
        warn(`"${category}" is already excluded.`);
      }
    });

  excludeCmd
    .command("remove <category>")
    .description("Remove a category from the exclusion list")
    .action((category: string) => {
      const removed = removeSpendingExclude(category);

      if (isJsonMode()) {
        printJson(jsonSuccess({ category, removed }));
        return;
      }

      if (removed) {
        success(`"${category}" is no longer excluded.`);
      } else {
        warn(`"${category}" was not in the exclusion list.`);
      }
    });

  excludeCmd
    .command("list")
    .description("Show all excluded categories")
    .action(() => {
      const categories = listSpendingExcludes();

      if (isJsonMode()) {
        printJson(jsonSuccess({ categories }));
        return;
      }

      if (categories.length === 0) {
        info("No excluded categories. Use `kolshek spending exclude add <category>` to add one.");
        return;
      }

      info("Categories excluded from lifestyle spending:");
      for (const cat of categories) {
        console.log(`  - ${cat}`);
      }
    });
}
