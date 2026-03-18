// Trends queries — multi-month cashflow analysis.

import { getDatabase } from "../database.js";
import { buildClassificationExcludeSQL } from "./categories.js";
import { DEFAULT_REPORT_EXCLUDES } from "../../types/index.js";
import { getMonthlyReport, type MonthlyRow, type DateRange } from "./reports.js";

// --- Total mode ---

export interface TrendTotal extends MonthlyRow {
  expenseChange: number | null;
  incomeChange: number | null;
}

export function getTotalTrends(
  range: DateRange,
  providerType?: string,
  excludeClassifications?: readonly string[],
): TrendTotal[] {
  const months = getMonthlyReport(range, providerType, excludeClassifications);
  // months come DESC — reverse for chronological MoM calc, then reverse back
  const chrono = [...months].reverse();

  return chrono.map((m, i): TrendTotal => {
    const prev = i > 0 ? chrono[i - 1] : null;

    return {
      ...m,
      expenseChange: prev != null && prev.expenses > 0
        ? Math.round(((m.expenses - prev.expenses) / prev.expenses) * 10000) / 100
        : null,
      incomeChange: prev != null && prev.income > 0
        ? Math.round(((m.income - prev.income) / prev.income) * 10000) / 100
        : null,
    };
  }).reverse();
}

// --- Category mode ---

export interface CategoryTrend {
  month: string;
  totalAmount: number;
  transactionCount: number;
  change: number | null;
}

export function getCategoryTrends(
  range: DateRange,
  category: string,
  providerType?: string,
  excludeClassifications?: readonly string[],
): CategoryTrend[] {
  const db = getDatabase();
  const excl = excludeClassifications ?? DEFAULT_REPORT_EXCLUDES;
  const { sql: excludeSQL, params: excludeParams } = buildClassificationExcludeSQL(excl);

  const params: Record<string, string | number> = {
    ...excludeParams,
    $category: category,
  };
  const conditions = [
    "t.charged_amount < 0",
    excludeSQL,
    "COALESCE(t.category, 'Uncategorized') = $category",
  ];

  if (range.from) { conditions.push("t.date >= $from"); params.$from = range.from; }
  if (range.to) { conditions.push("t.date <= $to"); params.$to = range.to; }
  if (providerType) { conditions.push("p.type = $providerType"); params.$providerType = providerType; }

  const sql = `
    SELECT strftime('%Y-%m', t.date) AS month,
      SUM(ABS(t.charged_amount)) AS total_amount,
      COUNT(*) AS transaction_count
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    JOIN providers p ON a.provider_id = p.id
    WHERE ${conditions.join(" AND ")}
    GROUP BY month
    ORDER BY month DESC
  `;

  const rows = db.prepare(sql).all(params) as Array<{
    month: string;
    total_amount: number;
    transaction_count: number;
  }>;

  const chrono = [...rows].reverse();
  return chrono.map((r, i): CategoryTrend => {
    const prev = i > 0 ? chrono[i - 1] : null;
    return {
      month: r.month,
      totalAmount: r.total_amount,
      transactionCount: r.transaction_count,
      change: prev && prev.total_amount > 0
        ? Math.round(((r.total_amount - prev.total_amount) / prev.total_amount) * 10000) / 100
        : null,
    };
  }).reverse();
}

// --- Fixed vs Variable mode ---

export interface FixedVariableMonth {
  month: string;
  fixed: number;
  variable: number;
  fixedPercent: number;
  fixedMerchants: number;
}

export function getFixedVariableTrends(
  range: DateRange,
  providerType?: string,
  excludeClassifications?: readonly string[],
): FixedVariableMonth[] {
  const db = getDatabase();
  const excl = excludeClassifications ?? DEFAULT_REPORT_EXCLUDES;
  const { sql: excludeSQL, params: excludeParams } = buildClassificationExcludeSQL(excl);

  const params: Record<string, string | number> = { ...excludeParams };
  const conditions = [
    "t.charged_amount < 0",
    excludeSQL,
  ];

  if (range.from) { conditions.push("t.date >= $from"); params.$from = range.from; }
  if (range.to) { conditions.push("t.date <= $to"); params.$to = range.to; }
  if (providerType) { conditions.push("p.type = $providerType"); params.$providerType = providerType; }

  // Get spending per merchant per month
  const sql = `
    SELECT
      strftime('%Y-%m', t.date) AS month,
      COALESCE(t.description_en, t.description) AS merchant,
      SUM(ABS(t.charged_amount)) AS total_amount
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    JOIN providers p ON a.provider_id = p.id
    WHERE ${conditions.join(" AND ")}
    GROUP BY month, merchant
    ORDER BY month, merchant
  `;

  const rows = db.prepare(sql).all(params) as Array<{
    month: string;
    merchant: string;
    total_amount: number;
  }>;

  // Find "fixed" merchants: appear in 3+ months
  const merchantMonths = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (!merchantMonths.has(r.merchant)) merchantMonths.set(r.merchant, new Map());
    merchantMonths.get(r.merchant)!.set(r.month, r.total_amount);
  }

  const fixedMerchants = new Set<string>();
  for (const [merchant, months] of merchantMonths) {
    if (months.size >= 3) {
      const amounts = [...months.values()];
      const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length;
      const maxDev = Math.max(...amounts.map((a) => Math.abs(a - avg) / avg));
      if (maxDev <= 0.2) fixedMerchants.add(merchant);
    }
  }

  // Aggregate by month
  const monthMap = new Map<string, { fixed: number; variable: number; fixedCount: number }>();
  for (const r of rows) {
    if (!monthMap.has(r.month)) monthMap.set(r.month, { fixed: 0, variable: 0, fixedCount: 0 });
    const entry = monthMap.get(r.month)!;
    if (fixedMerchants.has(r.merchant)) {
      entry.fixed += r.total_amount;
      entry.fixedCount += 1;
    } else {
      entry.variable += r.total_amount;
    }
  }

  return [...monthMap.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, d]) => ({
      month,
      fixed: Math.round(d.fixed * 100) / 100,
      variable: Math.round(d.variable * 100) / 100,
      fixedPercent: d.fixed + d.variable > 0
        ? Math.round((d.fixed / (d.fixed + d.variable)) * 10000) / 100
        : 0,
      fixedMerchants: d.fixedCount,
    }));
}
