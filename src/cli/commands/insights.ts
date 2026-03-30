// kolshek insights — AI-free financial alerts and recommendations.

import type { Command } from "commander";
import chalk from "chalk";
import { getInsights, type Insight } from "../../services/insights.js";
import { addClassificationOptions, parseClassificationFlags } from "../filter-utils.js";
import {
  isJsonMode,
  printJson,
  jsonSuccess,
  printError,
  info,
  getOutputOptions,
  ExitCode,
} from "../output.js";

function formatInsight(insight: Insight, noColor: boolean): string {
  const icon = insight.severity === "alert" ? "[!!]" : insight.severity === "warning" ? "[!]" : "[i]";
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
  const cmd = program
    .command("insights")
    .description("Financial alerts and recommendations based on spending patterns")
    .option("--months <n>", "Lookback period in months", parseInt, 3);

  addClassificationOptions(cmd);

  cmd.action((opts) => {
      const monthCount = opts.months ?? 3;
      if (isNaN(monthCount) || monthCount < 1) {
        printError("BAD_ARGS", "--months must be a positive integer");
        process.exit(ExitCode.BadArgs);
      }

      try {
        const { excludeClassifications } = parseClassificationFlags(opts);
        const result = getInsights({ months: monthCount, excludeClassifications });

        if (isJsonMode()) {
          printJson(jsonSuccess(result));
          return;
        }

        if (result.insights.length === 0) {
          info("No insights to report — spending patterns look normal.");
          return;
        }

        const noColor = getOutputOptions().noColor;
        const alerts = result.insights.filter((i) => i.severity === "alert");
        const warnings = result.insights.filter((i) => i.severity === "warning");
        const infos = result.insights.filter((i) => i.severity === "info");

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

        info(`\n${result.summary.total} insight(s) from the last ${monthCount} month(s).`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        printError("DB_ERROR", msg, {
          suggestions: ["Run 'kolshek fetch' to populate data first."],
        });
        process.exit(ExitCode.Error);
      }
    });
}
