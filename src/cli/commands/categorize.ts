// kolshek categorize — Manage category rules and apply them to transactions.

import type { Command } from "commander";
import { z } from "zod";
import type { RuleConditions, CategoryRuleInput } from "../../types/index.js";
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
import { formatConditions } from "../../core/rules.js";
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

// ---------------------------------------------------------------------------
// Zod schemas for conditions validation
// ---------------------------------------------------------------------------

const textMatchSchema = z.object({
  pattern: z.string().min(1),
  mode: z.enum(["substring", "exact", "regex"]).default("substring"),
});

const amountMatchSchema = z.object({
  exact: z.number().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
}).refine(
  (a) => a.exact !== undefined || a.min !== undefined || a.max !== undefined,
  { message: "Amount must have at least one of exact, min, or max" },
);

const ruleConditionsSchema = z.object({
  description: textMatchSchema.optional(),
  memo: textMatchSchema.optional(),
  account: z.string().min(1).optional(),
  amount: amountMatchSchema.optional(),
  direction: z.enum(["debit", "credit"]).optional(),
}).refine(
  (c) => c.description || c.memo || c.account || c.amount || c.direction,
  { message: "At least one condition is required" },
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// Build RuleConditions from CLI flags
function buildConditionsFromOpts(opts: Record<string, unknown>): RuleConditions | null {
  const conditions: RuleConditions = {};

  if (opts.match) {
    conditions.description = { pattern: String(opts.match), mode: "substring" };
  } else if (opts.matchExact) {
    conditions.description = { pattern: String(opts.matchExact), mode: "exact" };
  } else if (opts.matchRegex) {
    conditions.description = { pattern: String(opts.matchRegex), mode: "regex" };
  }

  if (opts.memo) {
    conditions.memo = { pattern: String(opts.memo), mode: "substring" };
  }

  if (opts.account) {
    conditions.account = String(opts.account);
  }

  // Amount: --amount for exact, --amount-min / --amount-max for range
  if (opts.amount !== undefined) {
    conditions.amount = { exact: Number(opts.amount) };
  } else if (opts.amountMin !== undefined || opts.amountMax !== undefined) {
    const amount: { min?: number; max?: number } = {};
    if (opts.amountMin !== undefined) amount.min = Number(opts.amountMin);
    if (opts.amountMax !== undefined) amount.max = Number(opts.amountMax);
    conditions.amount = amount;
  }

  if (opts.direction) {
    conditions.direction = String(opts.direction) as "debit" | "credit";
  }

  // Return null if no conditions were provided
  const hasAny = conditions.description || conditions.memo || conditions.account
    || conditions.amount || conditions.direction;
  return hasAny ? conditions : null;
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

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
    .option("--match <pattern>", "Substring match on description")
    .option("--match-exact <pattern>", "Exact match on description")
    .option("--match-regex <pattern>", "Regex match on description")
    .option("--memo <pattern>", "Substring match on memo")
    .option("--account <account>", "Account filter (e.g. 'leumi:12345' or '12345')")
    .option("--amount <number>", "Exact amount match", parseFloat)
    .option("--amount-min <number>", "Minimum amount (inclusive)", parseFloat)
    .option("--amount-max <number>", "Maximum amount (inclusive)", parseFloat)
    .option("--direction <dir>", "Direction filter: debit or credit")
    .option("--priority <number>", "Rule priority (higher = evaluated first)", parseInt, 0)
    .action((category: string, opts) => {
      const conditions = buildConditionsFromOpts(opts);

      if (!conditions) {
        printError("BAD_ARGS", "At least one condition is required (--match, --account, --amount, --direction, etc.)");
        process.exit(ExitCode.BadArgs);
      }

      // Validate conditions with Zod
      const parsed = ruleConditionsSchema.safeParse(conditions);
      if (!parsed.success) {
        printError("BAD_ARGS", parsed.error.issues[0].message);
        process.exit(ExitCode.BadArgs);
      }

      const priority = Number(opts.priority) || 0;
      const rule = addCategoryRule(category, parsed.data, priority);

      if (isJsonMode()) {
        printJson(
          jsonSuccess({
            id: rule.id,
            category: rule.category,
            conditions: rule.conditions,
            priority: rule.priority,
          }),
        );
        return;
      }

      success(`Rule #${rule.id} created: ${formatConditions(rule.conditions)} → ${category}`);
      if (rule.priority !== 0) {
        info(`  Priority: ${rule.priority}`);
      }
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
        ["ID", "Pri", "Category", "Conditions", "Created"],
        rules.map((r) => [
          String(r.id),
          String(r.priority),
          r.category,
          formatConditions(r.conditions),
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
      "Accepts both legacy format [{category, matchPattern}] and new format [{category, conditions, priority?}]",
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
            '  Example: echo \'[{"category":"Groceries","conditions":{"description":{"pattern":"שופרסל","mode":"substring"}}}]\' | kolshek cat rule import',
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

      const rules: CategoryRuleInput[] = [];
      for (const [i, entry] of parsed.entries()) {
        if (typeof entry !== "object" || entry === null) {
          printError("BAD_ARGS", `Invalid rule at index ${i}: must be an object`);
          process.exit(ExitCode.BadArgs);
        }

        const e = entry as Record<string, unknown>;

        if (!e.category || typeof e.category !== "string" || !e.category.trim()) {
          printError("BAD_ARGS", `Missing or empty "category" at index ${i}`);
          process.exit(ExitCode.BadArgs);
        }

        // Detect format: legacy (matchPattern) vs new (conditions)
        if (e.conditions) {
          // New format: validate conditions with Zod
          const condParsed = ruleConditionsSchema.safeParse(e.conditions);
          if (!condParsed.success) {
            printError("BAD_ARGS", `Invalid conditions at index ${i}: ${condParsed.error.issues[0].message}`);
            process.exit(ExitCode.BadArgs);
          }
          rules.push({
            category: e.category as string,
            conditions: condParsed.data,
            priority: typeof e.priority === "number" ? e.priority : 0,
          });
        } else if (e.matchPattern && typeof e.matchPattern === "string" && e.matchPattern.trim()) {
          // Legacy format: convert to conditions
          rules.push({
            category: e.category as string,
            conditions: { description: { pattern: e.matchPattern as string, mode: "substring" } },
            priority: typeof e.priority === "number" ? e.priority : 0,
          });
        } else {
          printError(
            "BAD_ARGS",
            `Rule at index ${i} needs either "conditions" or "matchPattern"`,
          );
          process.exit(ExitCode.BadArgs);
        }
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
