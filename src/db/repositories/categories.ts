/**
 * Category rule CRUD and application logic.
 */

import { getDatabase } from "../database.js";

export interface CategoryRule {
  id: number;
  category: string;
  matchPattern: string;
  createdAt: string;
}

interface CategoryRuleRow {
  id: number;
  category: string;
  match_pattern: string;
  created_at: string;
}

function rowToRule(row: CategoryRuleRow): CategoryRule {
  return {
    id: row.id,
    category: row.category,
    matchPattern: row.match_pattern,
    createdAt: row.created_at,
  };
}

/** Escape SQL LIKE wildcards so they are treated as literals. */
function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, "\\$&");
}

export function addCategoryRule(category: string, pattern: string): CategoryRule {
  const db = getDatabase();
  const result = db
    .prepare(
      "INSERT INTO category_rules (category, match_pattern) VALUES ($category, $pattern)",
    )
    .run({ $category: category, $pattern: pattern });

  const row = db
    .prepare("SELECT * FROM category_rules WHERE id = $id")
    .get({ $id: result.lastInsertRowid }) as CategoryRuleRow;

  return rowToRule(row);
}

export function listCategoryRules(): CategoryRule[] {
  const db = getDatabase();
  const rows = db
    .prepare("SELECT * FROM category_rules ORDER BY id")
    .all() as CategoryRuleRow[];

  return rows.map(rowToRule);
}

export function removeCategoryRule(id: number): boolean {
  const db = getDatabase();
  const result = db
    .prepare("DELETE FROM category_rules WHERE id = $id")
    .run({ $id: id });

  return result.changes > 0;
}

export interface ApplyRulesOptions {
  scope?: "uncategorized" | "all" | "from-category";
  fromCategory?: string;
  dryRun?: boolean;
}

export interface ApplyRulesResult {
  applied: number;
  uncategorized: number;
  dryRun: boolean;
  scope: string;
  fromCategory?: string;
}

export function applyCategoryRules(options?: ApplyRulesOptions): ApplyRulesResult {
  const db = getDatabase();
  const scope = options?.scope ?? "uncategorized";
  const dryRun = options?.dryRun ?? false;
  const fromCategory = options?.fromCategory;

  const rules = db
    .prepare("SELECT * FROM category_rules ORDER BY id")
    .all() as CategoryRuleRow[];

  let applied = 0;

  // Build category filter based on scope
  let categoryFilter: string;
  const extraParams: Record<string, string> = {};

  if (scope === "all") {
    categoryFilter = "";
  } else if (scope === "from-category") {
    categoryFilter = "AND category = $fromCategory";
    extraParams.$fromCategory = fromCategory!;
  } else {
    categoryFilter = "AND (category IS NULL OR category = 'Uncategorized')";
  }

  for (const rule of rules) {
    const pattern = `%${escapeLike(rule.match_pattern)}%`;
    const params = { $category: rule.category, $pattern: pattern, ...extraParams };

    if (dryRun) {
      const row = db
        .prepare(
          `SELECT COUNT(*) AS count FROM transactions
           WHERE (description LIKE $pattern ESCAPE '\\' OR description_en LIKE $pattern ESCAPE '\\')
             ${categoryFilter}`,
        )
        .get(params) as { count: number };
      applied += row.count;
    } else {
      const result = db
        .prepare(
          `UPDATE transactions
           SET category = $category, updated_at = datetime('now')
           WHERE (description LIKE $pattern ESCAPE '\\' OR description_en LIKE $pattern ESCAPE '\\')
             ${categoryFilter}`,
        )
        .run(params);
      applied += result.changes;
    }
  }

  // Set remaining NULLs to 'Uncategorized' (skip for from-category scope)
  let uncategorized = 0;
  if (scope !== "from-category") {
    if (dryRun) {
      const row = db
        .prepare("SELECT COUNT(*) AS count FROM transactions WHERE category IS NULL")
        .get() as { count: number };
      uncategorized = row.count;
    } else {
      const uncatResult = db
        .prepare(
          "UPDATE transactions SET category = 'Uncategorized', updated_at = datetime('now') WHERE category IS NULL",
        )
        .run();
      uncategorized = uncatResult.changes;
    }
  }

  const result: ApplyRulesResult = { applied, uncategorized, dryRun, scope };
  if (scope === "from-category") {
    result.fromCategory = fromCategory;
  }
  return result;
}

export interface CategorySummary {
  category: string;
  transactionCount: number;
  totalAmount: number;
}

export function listCategories(): CategorySummary[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT
         COALESCE(category, 'Uncategorized') AS category,
         COUNT(*) AS transaction_count,
         SUM(ABS(charged_amount)) AS total_amount
       FROM transactions
       GROUP BY category
       ORDER BY total_amount DESC`,
    )
    .all() as Array<{
    category: string;
    transaction_count: number;
    total_amount: number;
  }>;

  return rows.map((r) => ({
    category: r.category,
    transactionCount: r.transaction_count,
    totalAmount: r.total_amount,
  }));
}

// ---------------------------------------------------------------------------
// Category rename / merge
// ---------------------------------------------------------------------------

export interface RenameResult {
  transactionsUpdated: number;
  rulesUpdated: number;
}

export function renameCategory(oldName: string, newName: string): RenameResult {
  const db = getDatabase();
  db.run("BEGIN");
  try {
    const txResult = db
      .prepare(
        "UPDATE transactions SET category = $new, updated_at = datetime('now') WHERE category = $old",
      )
      .run({ $old: oldName, $new: newName });

    const ruleResult = db
      .prepare("UPDATE category_rules SET category = $new WHERE category = $old")
      .run({ $old: oldName, $new: newName });

    db.run("COMMIT");
    return {
      transactionsUpdated: txResult.changes,
      rulesUpdated: ruleResult.changes,
    };
  } catch (err) {
    db.run("ROLLBACK");
    throw err;
  }
}

export function renameCategoryDryRun(
  oldName: string,
  newName: string,
): { transactionsAffected: number; rulesAffected: number } {
  const db = getDatabase();
  // newName is accepted for API consistency but unused in dry-run counts
  void newName;

  const txRow = db
    .prepare("SELECT COUNT(*) AS count FROM transactions WHERE category = $old")
    .get({ $old: oldName }) as { count: number };

  const ruleRow = db
    .prepare("SELECT COUNT(*) AS count FROM category_rules WHERE category = $old")
    .get({ $old: oldName }) as { count: number };

  return {
    transactionsAffected: txRow.count,
    rulesAffected: ruleRow.count,
  };
}

// ---------------------------------------------------------------------------
// Bulk category migration
// ---------------------------------------------------------------------------

export interface BulkMigrateResult {
  totalTransactionsUpdated: number;
  totalRulesUpdated: number;
  categoriesProcessed: number;
}

export function bulkMigrateCategories(
  mapping: Record<string, string>,
): BulkMigrateResult {
  const db = getDatabase();
  const entries = Object.entries(mapping);

  const txStmt = db.prepare(
    "UPDATE transactions SET category = $new, updated_at = datetime('now') WHERE category = $old",
  );
  const ruleStmt = db.prepare(
    "UPDATE category_rules SET category = $new WHERE category = $old",
  );

  let totalTx = 0;
  let totalRules = 0;

  db.run("BEGIN");
  try {
    for (const [oldName, newName] of entries) {
      const txResult = txStmt.run({ $old: oldName, $new: newName });
      const ruleResult = ruleStmt.run({ $old: oldName, $new: newName });
      totalTx += txResult.changes;
      totalRules += ruleResult.changes;
    }
    db.run("COMMIT");
  } catch (err) {
    db.run("ROLLBACK");
    throw err;
  }

  return {
    totalTransactionsUpdated: totalTx,
    totalRulesUpdated: totalRules,
    categoriesProcessed: entries.length,
  };
}

export interface BulkMigrateDryRunEntry {
  oldName: string;
  newName: string;
  transactionsAffected: number;
  rulesAffected: number;
}

export function bulkMigrateCategoriesDryRun(
  mapping: Record<string, string>,
): BulkMigrateDryRunEntry[] {
  const db = getDatabase();

  const txStmt = db.prepare(
    "SELECT COUNT(*) AS count FROM transactions WHERE category = $old",
  );
  const ruleStmt = db.prepare(
    "SELECT COUNT(*) AS count FROM category_rules WHERE category = $old",
  );

  const results: BulkMigrateDryRunEntry[] = [];

  for (const [oldName, newName] of Object.entries(mapping)) {
    const txRow = txStmt.get({ $old: oldName }) as { count: number };
    const ruleRow = ruleStmt.get({ $old: oldName }) as { count: number };
    results.push({
      oldName,
      newName,
      transactionsAffected: txRow.count,
      rulesAffected: ruleRow.count,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Bulk rule import
// ---------------------------------------------------------------------------

export interface CategoryRuleInput {
  category: string;
  matchPattern: string;
}

export function bulkImportCategoryRules(
  rules: CategoryRuleInput[],
): { imported: number; skipped: number } {
  const db = getDatabase();
  let imported = 0;
  let skipped = 0;

  const insertStmt = db.prepare(
    `INSERT INTO category_rules (category, match_pattern)
     SELECT $category, $pattern
     WHERE NOT EXISTS (
       SELECT 1 FROM category_rules WHERE match_pattern = $pattern
     )`,
  );

  for (const rule of rules) {
    const result = insertStmt.run({
      $category: rule.category,
      $pattern: rule.matchPattern,
    });
    if (result.changes > 0) {
      imported++;
    } else {
      skipped++;
    }
  }

  return { imported, skipped };
}

// ---------------------------------------------------------------------------
// Enhanced category list with source info
// ---------------------------------------------------------------------------

export interface CategoryWithSource {
  category: string;
  transactionCount: number;
  totalAmount: number;
  ruleCount: number;
  source: "transactions" | "rules" | "both";
}

export function listCategoriesWithSource(): CategoryWithSource[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT
         cat.category,
         COALESCE(tc.transaction_count, 0) AS transaction_count,
         COALESCE(tc.total_amount, 0) AS total_amount,
         COALESCE(rc.rule_count, 0) AS rule_count,
         CASE
           WHEN COALESCE(tc.transaction_count, 0) > 0 AND COALESCE(rc.rule_count, 0) > 0 THEN 'both'
           WHEN COALESCE(rc.rule_count, 0) > 0 THEN 'rules'
           ELSE 'transactions'
         END AS source
       FROM (
         SELECT COALESCE(category, 'Uncategorized') AS category FROM transactions
         UNION
         SELECT category FROM category_rules
       ) cat
       LEFT JOIN (
         SELECT COALESCE(category, 'Uncategorized') AS category,
                COUNT(*) AS transaction_count,
                SUM(ABS(charged_amount)) AS total_amount
         FROM transactions
         GROUP BY category
       ) tc ON cat.category = tc.category
       LEFT JOIN (
         SELECT category, COUNT(*) AS rule_count
         FROM category_rules
         GROUP BY category
       ) rc ON cat.category = rc.category
       ORDER BY COALESCE(tc.total_amount, 0) DESC`,
    )
    .all() as Array<{
    category: string;
    transaction_count: number;
    total_amount: number;
    rule_count: number;
    source: string;
  }>;

  return rows.map((r) => ({
    category: r.category,
    transactionCount: r.transaction_count,
    totalAmount: r.total_amount,
    ruleCount: r.rule_count,
    source: r.source as "transactions" | "rules" | "both",
  }));
}

// ---------------------------------------------------------------------------
// Reassign categories by description pattern
// ---------------------------------------------------------------------------

export interface ReassignEntry {
  matchPattern: string;
  toCategory: string;
}

export function reassignCategory(
  matchPattern: string,
  toCategory: string,
): { updated: number } {
  const db = getDatabase();
  const pattern = `%${escapeLike(matchPattern)}%`;
  const result = db
    .prepare(
      `UPDATE transactions
       SET category = $toCategory, updated_at = datetime('now')
       WHERE (description LIKE $pattern ESCAPE '\\' OR description_en LIKE $pattern ESCAPE '\\')`,
    )
    .run({ $toCategory: toCategory, $pattern: pattern });

  return { updated: result.changes };
}

export function reassignCategoryDryRun(
  matchPattern: string,
  _toCategory: string,
): { affected: number } {
  const db = getDatabase();
  const pattern = `%${escapeLike(matchPattern)}%`;
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count FROM transactions
       WHERE (description LIKE $pattern ESCAPE '\\' OR description_en LIKE $pattern ESCAPE '\\')`,
    )
    .get({ $pattern: pattern }) as { count: number };

  return { affected: row.count };
}

export interface BulkReassignResult {
  totalUpdated: number;
  entriesProcessed: number;
}

export function bulkReassignCategories(
  entries: ReassignEntry[],
): BulkReassignResult {
  const db = getDatabase();
  const stmt = db.prepare(
    `UPDATE transactions
     SET category = $toCategory, updated_at = datetime('now')
     WHERE (description LIKE $pattern ESCAPE '\\' OR description_en LIKE $pattern ESCAPE '\\')`,
  );

  let totalUpdated = 0;

  db.run("BEGIN");
  try {
    for (const entry of entries) {
      const pattern = `%${escapeLike(entry.matchPattern)}%`;
      const result = stmt.run({ $toCategory: entry.toCategory, $pattern: pattern });
      totalUpdated += result.changes;
    }
    db.run("COMMIT");
  } catch (err) {
    db.run("ROLLBACK");
    throw err;
  }

  return { totalUpdated, entriesProcessed: entries.length };
}

export interface BulkReassignDryRunEntry {
  matchPattern: string;
  toCategory: string;
  affected: number;
}

export function bulkReassignCategoriesDryRun(
  entries: ReassignEntry[],
): BulkReassignDryRunEntry[] {
  const db = getDatabase();
  const stmt = db.prepare(
    `SELECT COUNT(*) AS count FROM transactions
     WHERE (description LIKE $pattern ESCAPE '\\' OR description_en LIKE $pattern ESCAPE '\\')`,
  );

  return entries.map((entry) => {
    const pattern = `%${escapeLike(entry.matchPattern)}%`;
    const row = stmt.get({ $pattern: pattern }) as { count: number };
    return {
      matchPattern: entry.matchPattern,
      toCategory: entry.toCategory,
      affected: row.count,
    };
  });
}
