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
  bulkImportCategoryRules,
  reassignCategory,
  reassignCategoryDryRun,
  bulkReassignCategories,
  bulkReassignCategoriesDryRun,
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
  ruleCmd
    .command("import [file]")
    .description(
      "Bulk-import category rules from a JSON file or stdin. " +
      'Format: [{"category": "...", "matchPattern": "..."}]',
    )
    .action(async (filePath?: string) => {
      let rawJson: string;

      if (filePath) {
        const file = Bun.file(filePath);
        if (!(await file.exists())) {
          printError("NOT_FOUND", `File not found: ${filePath}`);
          process.exit(ExitCode.BadArgs);
        }
        rawJson = await file.text();
      } else {
        if (process.stdin.isTTY) {
          printError(
            "BAD_ARGS",
            "No file specified and stdin is a terminal. " +
            "Pipe JSON or provide a file path.\n" +
            '  Example: echo \'[{"category":"Groceries","matchPattern":"שופרסל"}]\' | kolshek cat rule import',
          );
          process.exit(ExitCode.BadArgs);
        }
        rawJson = await new Response(Bun.stdin.stream()).text();
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawJson);
      } catch {
        printError("BAD_ARGS", "Invalid JSON input");
        process.exit(ExitCode.BadArgs);
      }

      if (!Array.isArray(parsed)) {
        printError("BAD_ARGS", "JSON must be an array of rule objects");
        process.exit(ExitCode.BadArgs);
      }

      const rules: Array<{ category: string; matchPattern: string }> = [];
      for (const [i, entry] of parsed.entries()) {
        if (
          typeof entry !== "object" || entry === null ||
          typeof (entry as Record<string, unknown>).category !== "string" ||
          typeof (entry as Record<string, unknown>).matchPattern !== "string"
        ) {
          printError(
            "BAD_ARGS",
            `Invalid rule at index ${i}: each entry needs "category" and "matchPattern" strings`,
          );
          process.exit(ExitCode.BadArgs);
        }
        const e = entry as { category: string; matchPattern: string };
        if (!e.matchPattern.trim() || !e.category.trim()) {
          printError("BAD_ARGS", `Empty category or pattern at index ${i}`);
          process.exit(ExitCode.BadArgs);
        }
        rules.push({ category: e.category, matchPattern: e.matchPattern });
      }

      const result = bulkImportCategoryRules(rules);

      if (isJsonMode()) {
        printJson(jsonSuccess(result));
        return;
      }

      success(`Imported ${result.imported} rule(s), skipped ${result.skipped} duplicate(s).`);
    });

  // --- categorize apply ---
  catCmd
    .command("apply")
    .description("Run category rules on transactions")
    .option("--all", "Re-apply rules to all transactions, not just uncategorized")
    .option("--from-category <name>", "Re-apply rules only to transactions in this category")
    .option("--dry-run", "Preview changes without modifying data")
    .action((opts) => {
      if (opts.all && opts.fromCategory) {
        printError("BAD_ARGS", "--all and --from-category are mutually exclusive");
        process.exit(ExitCode.BadArgs);
      }

      const scope = opts.all
        ? "all" as const
        : opts.fromCategory
          ? "from-category" as const
          : "uncategorized" as const;

      if (scope === "from-category" && !opts.fromCategory.trim()) {
        printError("BAD_ARGS", "--from-category value cannot be empty");
        process.exit(ExitCode.BadArgs);
      }

      const result = applyCategoryRules({
        scope,
        fromCategory: opts.fromCategory,
        dryRun: opts.dryRun,
      });

      if (isJsonMode()) {
        printJson(jsonSuccess(result));
        return;
      }

      const prefix = result.dryRun ? "Dry run: " : "";
      const scopeLabel = scope === "all"
        ? " (all transactions)"
        : scope === "from-category"
          ? ` (from "${opts.fromCategory}")`
          : "";

      success(
        `${prefix}Applied rules${scopeLabel}: ${result.applied} categorized, ${result.uncategorized} set to Uncategorized.`,
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

  // --- categorize reassign ---
  const reassignSchema = z.array(
    z.object({
      matchPattern: z.string().min(1),
      toCategory: z.string().min(1),
    }),
  );

  catCmd
    .command("reassign")
    .description("Force-reassign transactions matching a pattern to a new category")
    .option("--match <pattern>", "Substring to match against transaction description")
    .option("--to <category>", "Target category")
    .option(
      "--file <path>",
      'JSON file with [{ "matchPattern": "...", "toCategory": "..." }]',
    )
    .option("--dry-run", "Preview changes without modifying data")
    .action(async (opts) => {
      const hasMatch = opts.match !== undefined;
      const hasFile = opts.file !== undefined;

      if (!hasMatch && !hasFile) {
        printError("BAD_ARGS", "Provide --match/--to or --file");
        process.exit(ExitCode.BadArgs);
      }
      if (hasMatch && hasFile) {
        printError("BAD_ARGS", "--match and --file are mutually exclusive");
        process.exit(ExitCode.BadArgs);
      }
      if (hasMatch && !opts.to) {
        printError("BAD_ARGS", "--to is required when using --match");
        process.exit(ExitCode.BadArgs);
      }

      try {
        // --- Single reassign mode ---
        if (hasMatch) {
          const matchPattern = String(opts.match).trim();
          const toCategory = String(opts.to).trim();
          if (!matchPattern || !toCategory) {
            printError("BAD_ARGS", "--match and --to cannot be empty");
            process.exit(ExitCode.BadArgs);
          }

          if (opts.dryRun) {
            const preview = reassignCategoryDryRun(matchPattern, toCategory);
            if (isJsonMode()) {
              printJson(jsonSuccess({ dryRun: true, matchPattern, toCategory, ...preview }));
              return;
            }
            info(`Dry run: "${matchPattern}" → ${toCategory} — ${preview.affected} transaction(s) would be updated.`);
            return;
          }

          const result = reassignCategory(matchPattern, toCategory);
          if (isJsonMode()) {
            printJson(jsonSuccess({ matchPattern, toCategory, ...result }));
            return;
          }
          success(`Reassigned "${matchPattern}" → ${toCategory}: ${result.updated} transaction(s) updated.`);
          return;
        }

        // --- Bulk reassign from file ---
        const raw = await readJsonFile(opts.file);
        const parsed = reassignSchema.safeParse(raw);
        if (!parsed.success) {
          printError("BAD_ARGS", `Invalid file format: ${parsed.error.issues[0].message}`, {
            suggestions: [
              'Expected format: [{ "matchPattern": "...", "toCategory": "..." }]',
            ],
          });
          process.exit(ExitCode.BadArgs);
        }

        const entries = parsed.data;

        if (opts.dryRun) {
          const preview = bulkReassignCategoriesDryRun(entries);
          if (isJsonMode()) {
            printJson(jsonSuccess({ dryRun: true, entries: preview }));
            return;
          }

          const table = createTable(
            ["Match Pattern", "Target Category", "Transactions"],
            preview.map((p) => [p.matchPattern, p.toCategory, String(p.affected)]),
          );
          console.log(table);
          info("\nDry run — no changes made.");
          return;
        }

        const result = bulkReassignCategories(entries);
        if (isJsonMode()) {
          printJson(jsonSuccess(result));
          return;
        }
        success(
          `Reassigned ${result.entriesProcessed} pattern(s): ${result.totalUpdated} transaction(s) updated.`,
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
