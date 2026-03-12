// kolshek categorize — Manage category rules and apply them to transactions.

import type { Command } from "commander";
import { z } from "zod";
import {
  addCategoryRule,
  listCategoryRules,
  removeCategoryRule,
  applyCategoryRules,
  listCategoriesWithSource,
  renameCategory,
  renameCategoryDryRun,
  bulkMigrateCategories,
  bulkMigrateCategoriesDryRun,
  importCategoryRules,
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

async function readJsonFile(filePath: string): Promise<unknown> {
  const file = Bun.file(filePath);
  const exists = await file.exists();
  if (!exists) {
    throw new Error(`File not found: ${filePath}`);
  }
  const text = await file.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON in ${filePath}`);
  }
}

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

  // --- categorize rule import ---
  const categoryRuleImportSchema = z.array(
    z.object({
      category: z.string().min(1, "category must be non-empty"),
      match: z.string().min(1, "match must be non-empty"),
    }),
  );

  ruleCmd
    .command("import")
    .description("Import category rules from a JSON file")
    .requiredOption("--file <path>", "JSON file with rule definitions")
    .action(async (opts) => {
      try {
        const raw = await readJsonFile(opts.file);
        const parsed = categoryRuleImportSchema.safeParse(raw);
        if (!parsed.success) {
          printError("BAD_ARGS", `Invalid file format: ${parsed.error.issues[0].message}`, {
            suggestions: [
              'Expected format: [{ "category": "Groceries", "match": "שופרסל" }, ...]',
            ],
          });
          process.exit(ExitCode.BadArgs);
        }

        const result = importCategoryRules(parsed.data);

        if (isJsonMode()) {
          printJson(jsonSuccess(result));
          return;
        }

        success(`Imported ${result.imported} rule(s), skipped ${result.skipped} duplicate(s).`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        printError("FILE_ERROR", msg);
        process.exit(ExitCode.Error);
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

  // --- categorize rename ---
  catCmd
    .command("rename <old> <new>")
    .description("Rename or merge a category (updates transactions and rules)")
    .option("--dry-run", "Show what would change without modifying data")
    .action((oldName: string, newName: string, opts) => {
      if (!oldName.trim() || !newName.trim()) {
        printError("BAD_ARGS", "Category names cannot be empty");
        process.exit(ExitCode.BadArgs);
      }
      if (oldName === newName) {
        printError("BAD_ARGS", "Old and new category names are identical");
        process.exit(ExitCode.BadArgs);
      }

      if (opts.dryRun) {
        const preview = renameCategoryDryRun(oldName, newName);

        if (isJsonMode()) {
          printJson(jsonSuccess({ dryRun: true, oldName, newName, ...preview }));
          return;
        }

        if (preview.transactionsAffected === 0 && preview.rulesAffected === 0) {
          info(`No transactions or rules found with category "${oldName}".`);
          return;
        }

        info(`Dry run: rename "${oldName}" → "${newName}"`);
        info(`  Transactions affected: ${preview.transactionsAffected}`);
        info(`  Rules affected: ${preview.rulesAffected}`);
        return;
      }

      const result = renameCategory(oldName, newName);

      if (isJsonMode()) {
        printJson(jsonSuccess({ oldName, newName, ...result }));
        return;
      }

      if (result.transactionsUpdated === 0 && result.rulesUpdated === 0) {
        info(`No transactions or rules found with category "${oldName}".`);
        return;
      }

      success(
        `Renamed "${oldName}" → "${newName}": ${result.transactionsUpdated} transaction(s), ${result.rulesUpdated} rule(s) updated.`,
      );
    });

  // --- categorize migrate ---
  const migrateSchema = z.record(z.string().min(1), z.string().min(1));

  catCmd
    .command("migrate")
    .description("Bulk rename/merge categories from a JSON mapping file")
    .requiredOption("--file <path>", "JSON file with { oldName: newName } mapping")
    .option("--dry-run", "Preview changes without modifying data")
    .action(async (opts) => {
      try {
        const raw = await readJsonFile(opts.file);
        const parsed = migrateSchema.safeParse(raw);
        if (!parsed.success) {
          printError("BAD_ARGS", `Invalid file format: ${parsed.error.issues[0].message}`, {
            suggestions: [
              'Expected format: { "OldCategory": "NewCategory", ... }',
            ],
          });
          process.exit(ExitCode.BadArgs);
        }

        const mapping = parsed.data;

        // Reject self-mappings
        for (const [oldName, newName] of Object.entries(mapping)) {
          if (oldName === newName) {
            printError("BAD_ARGS", `Self-mapping not allowed: "${oldName}" → "${newName}"`);
            process.exit(ExitCode.BadArgs);
          }
        }

        if (opts.dryRun) {
          const preview = bulkMigrateCategoriesDryRun(mapping);

          if (isJsonMode()) {
            printJson(jsonSuccess({ dryRun: true, mappings: preview }));
            return;
          }

          if (preview.length === 0) {
            info("Empty mapping file — nothing to do.");
            return;
          }

          const table = createTable(
            ["Old Category", "New Category", "Transactions", "Rules"],
            preview.map((p) => [
              p.oldName,
              p.newName,
              String(p.transactionsAffected),
              String(p.rulesAffected),
            ]),
          );
          console.log(table);
          info("\nDry run — no changes made.");
          return;
        }

        const result = bulkMigrateCategories(mapping);

        if (isJsonMode()) {
          printJson(jsonSuccess(result));
          return;
        }

        success(
          `Migrated ${result.categoriesProcessed} category(s): ${result.totalTransactionsUpdated} transaction(s), ${result.totalRulesUpdated} rule(s) updated.`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        printError("FILE_ERROR", msg);
        process.exit(ExitCode.Error);
      }
    });

  // --- categorize list ---
  catCmd
    .command("list")
    .description("Show categories with transaction counts, totals, and source")
    .action(() => {
      const categories = listCategoriesWithSource();

      if (isJsonMode()) {
        printJson(jsonSuccess({ categories }));
        return;
      }

      if (categories.length === 0) {
        info("No categories found.");
        return;
      }

      const table = createTable(
        ["Category", "Transactions", "Total Amount", "Rules", "Source"],
        categories.map((c) => [
          c.category,
          String(c.transactionCount),
          formatCurrency(c.totalAmount),
          String(c.ruleCount),
          c.source,
        ]),
      );
      console.log(table);
    });
}
