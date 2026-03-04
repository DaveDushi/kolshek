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
         WHERE category IS NULL
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
