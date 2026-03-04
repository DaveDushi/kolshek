#!/usr/bin/env bun

/**
 * kolshek — CLI entry point.
 * Track finances from Israeli banks and credit cards.
 */

import { Command } from "commander";
import { existsSync } from "fs";
import { join } from "path";
import { setOutputOptions, ExitCode } from "./output.js";
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
import pkg from "../../package.json";

const program = new Command();

program
  .name("kolshek")
  .description(
    "Track finances from Israeli banks and credit cards (כל שקל)",
  )
  .version(pkg.version)
  .option("--json", "Output structured JSON", false)
  .option("-q, --quiet", "Suppress non-essential output", false)
  .option("--no-color", "Disable ANSI colors")
  .option("--no-progress", "Disable spinners and progress bars")
  .option("--non-interactive", "Never prompt; fail if input needed", false)
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
    if (commandName !== "init") {
      await ensureDirectories();
      const dbPath = getDbPath();
      initDatabase(dbPath);

      // First-run detection: check for config file, not just directory
      const paths = getAppPaths();
      if (
        !existsSync(join(paths.config, "config.toml")) &&
        !opts.json &&
        !opts.quiet
      ) {
        console.log(
          'Tip: Run "kolshek init" to set up your first bank or credit card provider.\n',
        );
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

// Parse and run
program.parseAsync(process.argv).catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("Fatal:", msg.length > 500 ? msg.slice(0, 500) + "..." : msg);
  process.exit(ExitCode.Error);
});
