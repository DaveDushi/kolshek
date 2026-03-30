// kolshek income — Income view with salary detection.

import type { Command } from "commander";
import { parseMonthToRange } from "../date-utils.js";
import { getIncome } from "../../services/income.js";
import { addClassificationOptions, parseClassificationFlags } from "../filter-utils.js";
import {
  isJsonMode,
  printJson,
  jsonSuccess,
  printError,
  info,
  createTable,
  formatCurrency,
  formatDate,
  ExitCode,
} from "../output.js";

export function registerIncomeCommand(program: Command): void {
  const cmd = program
    .command("income [month]")
    .description("Income breakdown with salary detection (bank accounts only by default)")
    .option("--salary-only", "Show only salary/wage transactions")
    .option("--include-refunds", "Also show CC refunds (separate section)")
    .option("-m, --month-offset <n>", "Months ago (e.g., -m 3 for 3 months ago)", parseInt);

  addClassificationOptions(cmd);

  cmd.action((month: string | undefined, opts) => {
      if (opts.monthOffset) month = `-${opts.monthOffset}`;
      const range = parseMonthToRange(month);

      if (!range) {
        printError("BAD_ARGS", `Could not parse month: "${month}". Use YYYY-MM, "prev", "-3", or a date.`);
        process.exit(ExitCode.BadArgs);
      }

      try {
        const { excludeClassifications } = parseClassificationFlags(opts);
        const result = getIncome({
          from: range.from,
          to: range.to,
          salaryOnly: opts.salaryOnly,
          includeRefunds: opts.includeRefunds,
          excludeClassifications,
        });

        if (isJsonMode()) {
          printJson(jsonSuccess({
            month: range.label,
            summary: result.summary,
            transactions: result.transactions,
          }));
          return;
        }

        if (result.transactions.length === 0) {
          info(`No income data for ${range.label}.`);
          return;
        }

        const table = createTable(
          ["Date", "Description", "Amount", "Type", "Provider"],
          result.transactions.map((t) => [
            formatDate(t.date),
            (t.descriptionEn ?? t.description).length > 35
              ? (t.descriptionEn ?? t.description).slice(0, 32) + "..."
              : (t.descriptionEn ?? t.description),
            formatCurrency(t.chargedAmount),
            t.incomeType,
            t.provider,
          ]),
        );
        console.log(table);

        const parts = [`Total: ${formatCurrency(result.summary.totalIncome)}`];
        if (result.summary.salary > 0) parts.push(`Salary: ${formatCurrency(result.summary.salary)}`);
        if (result.summary.transfers > 0) parts.push(`Transfers: ${formatCurrency(result.summary.transfers)}`);
        if (result.summary.refunds > 0) parts.push(`Refunds: ${formatCurrency(result.summary.refunds)}`);
        if (result.summary.other > 0) parts.push(`Other: ${formatCurrency(result.summary.other)}`);
        info(`\n${range.label} — ${parts.join(" | ")}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        printError("DB_ERROR", msg, {
          suggestions: ["Run 'kolshek fetch' to populate data first."],
        });
        process.exit(ExitCode.Error);
      }
    });
}
