// kolshek income — Income view with salary detection.

import type { Command } from "commander";
import { parseMonthToRange } from "../date-utils.js";
import { getIncomeReport } from "../../db/repositories/income.js";
import {
  isJsonMode,
  printJson,
  jsonSuccess,
  info,
  createTable,
  formatCurrency,
  formatDate,
} from "../output.js";

export function registerIncomeCommand(program: Command): void {
  program
    .command("income [month]")
    .description("Income breakdown with salary detection (bank accounts only by default)")
    .option("--salary-only", "Show only salary/wage transactions")
    .option("--include-refunds", "Also show CC refunds (separate section)")
    .option("-m, --month-offset <n>", "Months ago (e.g., -m 3 for 3 months ago)", parseInt)
    .action((month: string | undefined, opts) => {
      if (opts.monthOffset) month = `-${opts.monthOffset}`;
      const range = parseMonthToRange(month);

      const result = getIncomeReport({
        from: range.from,
        to: range.to,
        salaryOnly: opts.salaryOnly,
        includeRefunds: opts.includeRefunds,
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
      if (result.summary.refunds > 0) parts.push(`Refunds: ${formatCurrency(result.summary.refunds)}`);
      if (result.summary.other > 0) parts.push(`Other: ${formatCurrency(result.summary.other)}`);
      info(`\n${range.label} — ${parts.join(" | ")}`);
    });
}
