/**
 * kolshek categorize — Manage category rules and apply them to transactions.
 */

import type { Command } from "commander";
import {
  addCategoryRule,
  listCategoryRules,
  removeCategoryRule,
  applyCategoryRules,
  listCategories,
} from "../../db/repositories/categories.js";
import {
  isJsonMode,
  printJson,
  jsonSuccess,
  printError,
  success,
  info,
  createTable,
  formatCurrency,
  ExitCode,
} from "../output.js";

export function registerCategorizeCommand(program: Command): void {
  const catCmd = program
    .command("categorize")
    .alias("cat")
    .description("Manage category rules and apply them to transactions");

  // --- categorize rule ---
  const ruleCmd = catCmd
    .command("rule")
    .description("Manage category rules");

  // --- categorize rule add ---
  ruleCmd
    .command("add <category>")
    .description("Create a category rule")
    .requiredOption("--match <pattern>", "Substring pattern to match against description")
    .action((category: string, opts) => {
      const pattern = String(opts.match);
      if (!pattern.trim()) {
        printError("BAD_ARGS", "Match pattern cannot be empty");
        process.exit(ExitCode.BadArgs);
      }

      const rule = addCategoryRule(category, pattern);

      if (isJsonMode()) {
        printJson(
          jsonSuccess({
            id: rule.id,
            category: rule.category,
            matchPattern: rule.matchPattern,
          }),
        );
        return;
      }

      success(`Rule #${rule.id} created: "${pattern}" → ${category}`);
    });

  // --- categorize rule list ---
  ruleCmd
    .command("list")
    .description("List all category rules")
    .action(() => {
      const rules = listCategoryRules();

      if (isJsonMode()) {
        printJson(jsonSuccess({ rules }));
        return;
      }

      if (rules.length === 0) {
        info("No category rules defined. Use 'kolshek categorize rule add' to create one.");
        return;
      }

      const table = createTable(
        ["ID", "Category", "Match Pattern", "Created"],
        rules.map((r) => [
          String(r.id),
          r.category,
          r.matchPattern,
          r.createdAt,
        ]),
      );
      console.log(table);
      info(`\n${rules.length} rule(s).`);
    });

  // --- categorize rule remove ---
  ruleCmd
    .command("remove <id>")
    .description("Delete a category rule")
    .action((idStr: string) => {
      const id = parseInt(idStr, 10);
      if (isNaN(id)) {
        printError("BAD_ARGS", "Rule ID must be a number");
        process.exit(ExitCode.BadArgs);
      }

      const removed = removeCategoryRule(id);

      if (isJsonMode()) {
        if (removed) {
          printJson(jsonSuccess({ id, removed: true }));
        } else {
          printError("NOT_FOUND", `Rule #${id} not found`);
          process.exit(ExitCode.BadArgs);
        }
        return;
      }

      if (removed) {
        success(`Rule #${id} removed.`);
      } else {
        printError("NOT_FOUND", `Rule #${id} not found`);
        process.exit(ExitCode.BadArgs);
      }
    });

  // --- categorize apply ---
  catCmd
    .command("apply")
    .description("Run category rules on uncategorized transactions")
    .action(() => {
      const result = applyCategoryRules();

      if (isJsonMode()) {
        printJson(jsonSuccess(result));
        return;
      }

      success(
        `Applied rules: ${result.applied} categorized, ${result.uncategorized} set to Uncategorized.`,
      );
    });

  // --- categorize list ---
  catCmd
    .command("list")
    .description("Show categories with transaction counts and totals")
    .action(() => {
      const categories = listCategories();

      if (isJsonMode()) {
        printJson(jsonSuccess({ categories }));
        return;
      }

      if (categories.length === 0) {
        info("No transactions found.");
        return;
      }

      const table = createTable(
        ["Category", "Transactions", "Total Amount"],
        categories.map((c) => [
          c.category,
          String(c.transactionCount),
          formatCurrency(c.totalAmount),
        ]),
      );
      console.log(table);
    });
}
