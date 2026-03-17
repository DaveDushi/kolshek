#!/usr/bin/env bun

/**
 * kolshek — CLI entry point.
 * Track finances from Israeli banks and credit cards.
 */

import { Command } from "commander";
import { existsSync } from "fs";
import { join } from "path";
import { setOutputOptions, ExitCode, createSpinner, isInteractive } from "./output.js";
import { getAppPaths, ensureDirectories, getDbPath } from "../config/loader.js";
import { initDatabase, closeDatabase } from "../db/database.js";
import { registerInitCommand } from "./commands/init.js";
import { registerProvidersCommand } from "./commands/providers.js";
import { registerFetchCommand } from "./commands/fetch.js";
import { registerTransactionsCommand } from "./commands/transactions.js";
import { registerAccountsCommand } from "./commands/accounts.js";
import { registerDbCommand } from "./commands/db.js";
import { registerQueryCommand } from "./commands/query.js";
import { registerReportsCommand } from "./commands/reports.js";
import { registerCategorizeCommand } from "./commands/categorize.js";
import { registerTranslateCommand } from "./commands/translate.js";
import { registerScheduleCommand } from "./commands/schedule.js";
import { registerPluginCommand } from "./commands/plugin.js";
import { registerSpendingCommand } from "./commands/spending.js";
import { registerIncomeCommand } from "./commands/income.js";
import { registerTrendsCommand } from "./commands/trends.js";
import { registerInsightsCommand } from "./commands/insights.js";
import { registerDashboardCommand } from "./commands/dashboard.js";
import { registerUpdateCommand } from "./commands/update.js";
import { getMostRecentSyncTime, listProviders } from "../db/repositories/providers.js";
import { loadConfig } from "../config/loader.js";
import { syncProviders } from "../core/sync-engine.js";
import pkg from "../../package.json";
import { getSplashBanner } from "./splash.js";

const program = new Command();

program
  .name("kolshek")
  .description(
    "Track finances from Israeli banks and credit cards (כל שקל)",
  )
  .addHelpText("beforeAll", () => getSplashBanner(program.opts().color !== false))
  .version(pkg.version)
  .option("--json", "Output structured JSON", false)
  .option("-q, --quiet", "Suppress non-essential output", false)
  .option("--no-color", "Disable ANSI colors")
  .option("--no-progress", "Disable spinners and progress bars")
  .option("--non-interactive", "Never prompt; fail if input needed", false)
  .option("--no-auto-fetch", "Skip automatic fetch on stale data")
  .hook("preAction", async (_thisCommand, actionCommand) => {
    // Apply global output options
    const opts = program.opts();
    setOutputOptions({
      json: opts.json,
      quiet: opts.quiet,
      noColor: opts.color === false,
      noProgress: opts.progress === false,
      nonInteractive: opts.nonInteractive,
    });

    // Ensure data directories and init DB for commands that need it
    const commandName = actionCommand.name();
    if (commandName !== "init" && commandName !== "update") {
      await ensureDirectories();
      const dbPath = getDbPath();
      initDatabase(dbPath);

      // First-run detection: check for config file, not just directory
      const paths = getAppPaths();
      if (
        listProviders().length === 0 &&
        !existsSync(join(paths.config, "config.toml")) &&
        !opts.json &&
        !opts.quiet
      ) {
        console.log(
          'Tip: Run "kolshek init" to set up your first bank or credit card provider.\n',
        );
      }

      // Auto-fetch if data is stale
      const autoFetchTriggers = new Set(["list", "search", "accounts", "reports", "query", "summary", "spending", "income", "trends", "insights"]);
      if (
        opts.autoFetch !== false &&
        autoFetchTriggers.has(commandName) &&
        isInteractive()
      ) {
        const config = await loadConfig();
        const thresholdHours = config.autoFetchAfterHours;
        if (thresholdHours > 0) {
          const lastSync = getMostRecentSyncTime();
          if (lastSync) {
            const hoursSince = (Date.now() - new Date(lastSync).getTime()) / (1000 * 60 * 60);
            if (hoursSince > thresholdHours) {
              const hoursAgo = Math.round(hoursSince);
              const spinner = createSpinner(`Auto-fetching (last sync ${hoursAgo}h ago)...`);
              spinner.start();
              try {
                // Run sync directly instead of runFetch() which calls process.exit()
                const providers = listProviders();
                if (providers.length > 0) {
                  const result = await syncProviders(providers, { config });
                  if (result.hasErrors) {
                    spinner.fail("Auto-fetch had errors (continuing with cached data).");
                  } else {
                    spinner.succeed(`Auto-fetch complete (${result.totalAdded} added, ${result.totalUpdated} updated).`);
                  }
                } else {
                  spinner.stop();
                }
              } catch {
                spinner.fail("Auto-fetch failed (continuing with cached data).");
              }
            }
          }
        }
      }
    }
  })
  .hook("postAction", () => {
    closeDatabase();
  });

// Register subcommands
registerInitCommand(program);
registerProvidersCommand(program);
registerFetchCommand(program);
registerTransactionsCommand(program);
registerAccountsCommand(program);
registerDbCommand(program);
registerQueryCommand(program);
registerReportsCommand(program);
registerCategorizeCommand(program);
registerTranslateCommand(program);
registerScheduleCommand(program);
registerPluginCommand(program);
registerSpendingCommand(program);
registerIncomeCommand(program);
registerTrendsCommand(program);
registerInsightsCommand(program);
registerDashboardCommand(program);
registerUpdateCommand(program);

// Parse and run
program.parseAsync(process.argv).then(() => {
  process.exit(0);
}).catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("Fatal:", msg.length > 500 ? msg.slice(0, 500) + "..." : msg);
  process.exit(ExitCode.Error);
});
