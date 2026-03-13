// kolshek insights — AI-free financial alerts and recommendations.

import type { Command } from "commander";
import { subMonths } from "date-fns";
import chalk from "chalk";
import {
  getCategoryByMonth,
  getLargeTransactions,
  getMerchantHistory,
  getMonthCashflow,
} from "../../db/repositories/insights.js";
import {
  detectCategorySpikes,
  detectLargeTransactions,
  detectNewMerchants,
  detectRecurringChanges,
  detectTrendWarnings,
  type Insight,
} from "../../core/insights.js";
import {
  isJsonMode,
  printJson,
  jsonSuccess,
  info,
  getOutputOptions,
} from "../output.js";

function formatInsight(insight: Insight, noColor: boolean): string {
  const icon = insight.severity === "alert" ? "[!]" : insight.severity === "warning" ? "[!]" : "[i]";
  const prefix = noColor
    ? icon
    : insight.severity === "alert"
      ? chalk.red(icon)
      : insight.severity === "warning"
        ? chalk.yellow(icon)
        : chalk.cyan(icon);

  const title = noColor ? insight.title : chalk.bold(insight.title);
  return `  ${prefix} ${title}\n      ${insight.detail}`;
}

export function registerInsightsCommand(program: Command): void {
  program
    .command("insights")
    .description("Financial alerts and recommendations based on spending patterns")
    .option("--months <n>", "Lookback period in months", parseInt, 3)
    .action((opts) => {
      const monthCount = opts.months ?? 3;
      const now = new Date();
      const from = subMonths(now, monthCount).toISOString().slice(0, 10);
      const currentMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

      const insightOpts = { from, currentMonthStart };

      // Gather all raw data
      const categoryData = getCategoryByMonth(insightOpts);
      const currentCategories = categoryData.filter((c) => c.month >= currentMonthStart.slice(0, 7));
      const priorCategories = categoryData.filter((c) => c.month < currentMonthStart.slice(0, 7));

      const { transactions: largeTxns, avgAmount } = getLargeTransactions(insightOpts);
      const merchantHistory = getMerchantHistory(insightOpts);
      const cashflow = getMonthCashflow(insightOpts);

      // Run detectors
      const insights: Insight[] = [
        ...detectCategorySpikes(currentCategories, priorCategories),
        ...detectLargeTransactions(largeTxns, avgAmount),
        ...detectNewMerchants(merchantHistory),
        ...detectRecurringChanges(merchantHistory),
        ...detectTrendWarnings(cashflow),
      ];

      // Sort by severity
      const order = { alert: 0, warning: 1, info: 2 };
      insights.sort((a, b) => order[a.severity] - order[b.severity]);

      if (isJsonMode()) {
        const summary = {
          total: insights.length,
          alerts: insights.filter((i) => i.severity === "alert").length,
          warnings: insights.filter((i) => i.severity === "warning").length,
          info: insights.filter((i) => i.severity === "info").length,
        };
        printJson(jsonSuccess({ period: { from, months: monthCount }, insights, summary }));
        return;
      }

      if (insights.length === 0) {
        info("No insights to report — spending patterns look normal.");
        return;
      }

      const noColor = getOutputOptions().noColor;
      const alerts = insights.filter((i) => i.severity === "alert");
      const warnings = insights.filter((i) => i.severity === "warning");
      const infos = insights.filter((i) => i.severity === "info");

      if (alerts.length > 0) {
        console.log(noColor ? "\nAlerts:" : chalk.red.bold("\nAlerts:"));
        for (const i of alerts) console.log(formatInsight(i, noColor));
      }
      if (warnings.length > 0) {
        console.log(noColor ? "\nWarnings:" : chalk.yellow.bold("\nWarnings:"));
        for (const i of warnings) console.log(formatInsight(i, noColor));
      }
      if (infos.length > 0) {
        console.log(noColor ? "\nInfo:" : chalk.cyan.bold("\nInfo:"));
        for (const i of infos) console.log(formatInsight(i, noColor));
      }

      info(`\n${insights.length} insight(s) from the last ${monthCount} month(s).`);
    });
}
