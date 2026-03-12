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

export function applyCategoryRules(): { applied: number; uncategorized: number } {
  const db = getDatabase();
  const rules = db
    .prepare("SELECT * FROM category_rules ORDER BY id")
    .all() as CategoryRuleRow[];

  let applied = 0;

  for (const rule of rules) {
    const pattern = `%${escapeLike(rule.match_pattern)}%`;
    const result = db
      .prepare(
        `UPDATE transactions
         SET category = $category, updated_at = datetime('now')
         WHERE (category IS NULL OR category = 'Uncategorized')
           AND (description LIKE $pattern ESCAPE '\\' OR description_en LIKE $pattern ESCAPE '\\')`,
      )
      .run({ $category: rule.category, $pattern: pattern });

    applied += result.changes;
  }

  // Set remaining NULLs to 'Uncategorized'
  const uncatResult = db
    .prepare(
      "UPDATE transactions SET category = 'Uncategorized', updated_at = datetime('now') WHERE category IS NULL",
    )
    .run();

  return { applied, uncategorized: uncatResult.changes };
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
