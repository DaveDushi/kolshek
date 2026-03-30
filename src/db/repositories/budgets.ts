// Budget CRUD and budget-vs-actual comparison queries.

import { getDatabase } from "../database.js";
import { buildClassificationExcludeSQL } from "./categories.js";
import { DEFAULT_SPENDING_EXCLUDES } from "../../types/index.js";

export interface Budget {
  id: number;
  category: string;
  month: string | null;
  targetAmount: number;
  createdAt: string;
}

interface BudgetRow {
  id: number;
  category: string;
  month: string | null;
  target_amount: number;
  created_at: string;
}

function rowToBudget(row: BudgetRow): Budget {
  return {
    id: row.id,
    category: row.category,
    month: row.month,
    targetAmount: row.target_amount,
    createdAt: row.created_at,
  };
}

// List budgets. If month is given, merges recurring (month=NULL) with
// month-specific overrides (specific month wins if both exist).
export function listBudgets(month?: string): Budget[] {
  const db = getDatabase();

  if (!month) {
    const rows = db
      .prepare("SELECT * FROM budgets ORDER BY category, month")
      .all() as BudgetRow[];
    return rows.map(rowToBudget);
  }

  // Merge: recurring budgets + month-specific overrides
  const rows = db
    .prepare(
      `SELECT * FROM budgets
       WHERE month IS NULL OR month = $month
       ORDER BY category, month`,
    )
    .all({ $month: month }) as BudgetRow[];

  // For each category, prefer the month-specific row over the recurring one
  const byCategory = new Map<string, BudgetRow>();
  for (const row of rows) {
    const existing = byCategory.get(row.category);
    if (!existing || (row.month !== null && existing.month === null)) {
      byCategory.set(row.category, row);
    }
  }

  return [...byCategory.values()].map(rowToBudget);
}

// Set (upsert) a budget target for a category
export function setBudget(
  category: string,
  targetAmount: number,
  month?: string,
): Budget {
  const db = getDatabase();
  db.prepare(
    `INSERT INTO budgets (category, month, target_amount)
     VALUES ($category, $month, $targetAmount)
     ON CONFLICT(category, month) DO UPDATE SET target_amount = $targetAmount`,
  ).run({
    $category: category,
    $month: month ?? null,
    $targetAmount: targetAmount,
  });

  const row = db
    .prepare(
      "SELECT * FROM budgets WHERE category = $category AND (month IS $month)",
    )
    .get({ $category: category, $month: month ?? null }) as BudgetRow;
  return rowToBudget(row);
}

// Delete a budget
export function deleteBudget(category: string, month?: string): boolean {
  const db = getDatabase();
  const result = db
    .prepare(
      "DELETE FROM budgets WHERE category = $category AND (month IS $month)",
    )
    .run({ $category: category, $month: month ?? null });
  return result.changes > 0;
}

// Budget vs actual spending for a given month
export interface BudgetComparison {
  category: string;
  target: number;
  actual: number;
  remaining: number;
  percentage: number;
}

export function getBudgetVsActual(month: string): BudgetComparison[] {
  const budgets = listBudgets(month);
  if (budgets.length === 0) return [];

  const db = getDatabase();
  const from = month + "-01";
  // End of month: go to next month day 1, subtract 1 day
  const [y, m] = month.split("-").map(Number);
  const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  const to = nextMonth + "-01T00:00:00.000Z";

  const { sql: excludeSQL, params: excludeParams } = buildClassificationExcludeSQL(DEFAULT_SPENDING_EXCLUDES);

  const sql = `
    SELECT
      COALESCE(t.category, 'Uncategorized') AS category,
      SUM(ABS(t.charged_amount)) AS total_amount
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    JOIN providers p ON a.provider_id = p.id
    WHERE t.charged_amount < 0
      AND t.date >= $from
      AND t.date < $to
      AND ${excludeSQL}
    GROUP BY category
  `;

  const rows = db.prepare(sql).all({ $from: from, $to: to, ...excludeParams }) as Array<{
    category: string;
    total_amount: number;
  }>;

  const actualByCategory = new Map(rows.map((r) => [r.category, r.total_amount]));

  return budgets.map((b) => {
    const actual = actualByCategory.get(b.category) ?? 0;
    return {
      category: b.category,
      target: b.targetAmount,
      actual,
      remaining: Math.round((b.targetAmount - actual) * 100) / 100,
      percentage: b.targetAmount > 0
        ? Math.round((actual / b.targetAmount) * 10000) / 100
        : 0,
    };
  });
}
