// CRUD for user-defined spending exclusions.
// Categories in the spending_excludes table are filtered out
// by insights (large transactions, merchants) and spending --lifestyle.

import { getDatabase } from "../database.js";

export function addSpendingExclude(category: string): { created: boolean } {
  const db = getDatabase();
  const existing = db
    .prepare("SELECT 1 FROM spending_excludes WHERE category = $category")
    .get({ $category: category });

  if (existing) return { created: false };

  db.prepare("INSERT INTO spending_excludes (category) VALUES ($category)").run({
    $category: category,
  });
  return { created: true };
}

export function removeSpendingExclude(category: string): boolean {
  const db = getDatabase();
  const result = db
    .prepare("DELETE FROM spending_excludes WHERE category = $category")
    .run({ $category: category });
  return result.changes > 0;
}

export function listSpendingExcludes(): string[] {
  const db = getDatabase();
  const rows = db
    .prepare("SELECT category FROM spending_excludes ORDER BY category")
    .all() as Array<{ category: string }>;
  return rows.map((r) => r.category);
}

// SQL fragment for use in other repositories.
// Returns a condition string that excludes user-defined categories.
// Uses a subquery so the exclusion list is always fresh.
export const EXCLUDE_LIFESTYLE_SQL =
  "COALESCE(t.category, '') NOT IN (SELECT category FROM spending_excludes)";
