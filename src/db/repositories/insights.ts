// Raw data queries for insight detectors.

import { getDatabase } from "../database.js";
import { buildClassificationExcludeSQL } from "./categories.js";
import { DEFAULT_REPORT_EXCLUDES } from "../../types/index.js";

// Default exclusion for detectors that should hide non-spending categories
const LIFESTYLE_EXCLUDES = ["cc_billing", "transfer", "investment"] as const;

interface InsightOpts {
  from: string;
  currentMonthStart: string;
  excludeClassifications?: readonly string[];
}

export interface CategoryByMonth {
  month: string;
  category: string;
  total: number;
}

// Category spikes: exclude cc_billing only by default.
// Fee/transfer spikes ARE worth flagging as category anomalies.
export function getCategoryByMonth(opts: InsightOpts): CategoryByMonth[] {
  const db = getDatabase();
  const excl = opts.excludeClassifications ?? DEFAULT_REPORT_EXCLUDES;
  const { sql: excludeSQL, params: excludeParams } = buildClassificationExcludeSQL(excl);

  const sql = `
    SELECT strftime('%Y-%m', t.date) AS month,
      COALESCE(t.category, 'Uncategorized') AS category,
      SUM(ABS(t.charged_amount)) AS total
    FROM transactions t
    WHERE t.charged_amount < 0 AND t.date >= $from
      AND ${excludeSQL}
    GROUP BY month, category
    ORDER BY month, total DESC
  `;
  return db.prepare(sql).all({ $from: opts.from, ...excludeParams }) as CategoryByMonth[];
}

export interface LargeTransactionRow {
  description: string;
  amount: number;
  date: string;
}

// Large transactions: exclude non-spending categories
// so transfers, CC settlements, and investment moves don't appear as notable charges.
export function getLargeTransactions(opts: InsightOpts): { transactions: LargeTransactionRow[]; avgAmount: number } {
  const db = getDatabase();
  const excl = opts.excludeClassifications ?? LIFESTYLE_EXCLUDES;
  const { sql: excludeSQL, params: excludeParams } = buildClassificationExcludeSQL(excl);

  const avgRow = db.prepare(`
    SELECT ROUND(AVG(ABS(t.charged_amount)), 2) AS avg_amount
    FROM transactions t WHERE t.charged_amount < 0 AND t.date >= $from
      AND ${excludeSQL}
  `).get({ $from: opts.currentMonthStart, ...excludeParams }) as { avg_amount: number } | null;

  const avgAmount = avgRow?.avg_amount ?? 0;

  const rows = db.prepare(`
    SELECT COALESCE(t.description_en, t.description) AS description,
      ABS(t.charged_amount) AS amount, t.date
    FROM transactions t WHERE t.charged_amount < 0 AND t.date >= $from
      AND ${excludeSQL}
    ORDER BY amount DESC LIMIT 20
  `).all({ $from: opts.currentMonthStart, ...excludeParams }) as LargeTransactionRow[];

  return { transactions: rows, avgAmount };
}

export interface MerchantHistoryRow {
  merchant: string;
  monthsSeen: number;
  currentAmount: number;
  avgAmount: number;
  firstSeen: string;
}

// Merchant history: exclude non-spending categories
// so internal transfers and settlements don't appear as merchants.
export function getMerchantHistory(opts: InsightOpts): MerchantHistoryRow[] {
  const db = getDatabase();
  const excl = opts.excludeClassifications ?? LIFESTYLE_EXCLUDES;
  const { sql: excludeSQL, params: excludeParams } = buildClassificationExcludeSQL(excl);

  const sql = `
    WITH monthly AS (
      SELECT
        COALESCE(t.description_en, t.description) AS merchant,
        strftime('%Y-%m', t.date) AS month,
        SUM(ABS(t.charged_amount)) AS month_total,
        MIN(t.date) AS first_tx
      FROM transactions t
      WHERE t.charged_amount < 0 AND t.date >= $from
        AND ${excludeSQL}
      GROUP BY merchant, month
    )
    SELECT
      merchant,
      COUNT(DISTINCT month) AS months_seen,
      SUM(CASE WHEN month >= substr($currentMonth, 1, 7) THEN month_total ELSE 0 END) AS current_amount,
      ROUND(AVG(month_total), 2) AS avg_amount,
      MIN(first_tx) AS first_seen
    FROM monthly
    GROUP BY merchant
    HAVING current_amount > 0
    ORDER BY current_amount DESC
  `;
  const rows = db.prepare(sql).all({
    $from: opts.from,
    $currentMonth: opts.currentMonthStart,
    ...excludeParams,
  }) as Array<{
    merchant: string;
    months_seen: number;
    current_amount: number;
    avg_amount: number;
    first_seen: string;
  }>;

  return rows.map((r) => ({
    merchant: r.merchant,
    monthsSeen: r.months_seen,
    currentAmount: r.current_amount,
    avgAmount: r.avg_amount,
    firstSeen: r.first_seen,
  }));
}

export interface MonthCashflowRow {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

// Cashflow: exclude cc_billing only by default.
// Transfers/savings are real money movement from the account perspective.
export function getMonthCashflow(opts: InsightOpts): MonthCashflowRow[] {
  const db = getDatabase();
  const excl = opts.excludeClassifications ?? DEFAULT_REPORT_EXCLUDES;
  const { sql: excludeSQL, params: excludeParams } = buildClassificationExcludeSQL(excl);

  const sql = `
    SELECT strftime('%Y-%m', date) AS month,
      SUM(CASE WHEN charged_amount > 0 THEN charged_amount ELSE 0 END) AS income,
      SUM(CASE WHEN charged_amount < 0 THEN ABS(charged_amount) ELSE 0 END) AS expenses,
      SUM(charged_amount) AS net
    FROM transactions t
    WHERE t.date >= $from AND ${excludeSQL}
    GROUP BY month ORDER BY month DESC
  `;
  return db.prepare(sql).all({ $from: opts.from, ...excludeParams }) as MonthCashflowRow[];
}
