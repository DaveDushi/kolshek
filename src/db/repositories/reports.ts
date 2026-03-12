/**
 * Aggregate SQL queries for financial reports.
 */

import { getDatabase } from "../database.js";
import { CC_BILLING_CATEGORY } from "../../types/transaction.js";

export interface DateRange {
  from?: string;
  to?: string;
}

type SqlParams = Record<string, string | number | null>;

/** Build WHERE conditions for date range and optional provider type filter */
function buildDateConditions(
  range: DateRange,
  providerType?: string,
): { conditions: string[]; params: SqlParams } {
  const conditions: string[] = [];
  const params: SqlParams = {};

  if (range.from) {
    conditions.push("t.date >= $from");
    params.$from = range.from;
  }
  if (range.to) {
    conditions.push("t.date <= $to");
    params.$to = range.to.length === 10 ? range.to + "T23:59:59.999Z" : range.to;
  }
  if (providerType) {
    conditions.push("p.type = $providerType");
    params.$providerType = providerType;
  }

  return { conditions, params };
}

function whereClause(conditions: string[]): string {
  return conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";
}

// ---------------------------------------------------------------------------
// Monthly report
// ---------------------------------------------------------------------------

export interface MonthlyRow {
  month: string;
  income: number;
  bankExpenses: number;
  ccExpenses: number;
  ccCharge: number;
  net: number;
  transactionCount: number;
}

export function getMonthlyReport(
  range: DateRange,
  providerType?: string,
): MonthlyRow[] {
  const db = getDatabase();
  const { conditions, params } = buildDateConditions(range, providerType);
  params.$ccBilling = CC_BILLING_CATEGORY;

  const sql = `
    SELECT
      strftime('%Y-%m', t.date) AS month,
      SUM(CASE WHEN t.charged_amount > 0 THEN t.charged_amount ELSE 0 END) AS income,
      SUM(CASE WHEN t.charged_amount < 0 AND p.type = 'bank'
                AND COALESCE(t.category, '') != $ccBilling
           THEN ABS(t.charged_amount) ELSE 0 END) AS bank_expenses,
      SUM(CASE WHEN t.charged_amount < 0 AND p.type = 'credit_card'
           THEN ABS(t.charged_amount) ELSE 0 END) AS cc_expenses,
      SUM(CASE WHEN t.category = $ccBilling
           THEN ABS(t.charged_amount) ELSE 0 END) AS cc_charge,
      SUM(CASE WHEN COALESCE(t.category, '') != $ccBilling
           THEN t.charged_amount ELSE 0 END) AS net,
      COUNT(CASE WHEN COALESCE(t.category, '') != $ccBilling THEN 1 END) AS transaction_count
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    JOIN providers p ON a.provider_id = p.id
    ${whereClause(conditions)}
    GROUP BY month
    ORDER BY month DESC
  `;

  const rows = db.prepare(sql).all(params) as Array<{
    month: string;
    income: number;
    bank_expenses: number;
    cc_expenses: number;
    cc_charge: number;
    net: number;
    transaction_count: number;
  }>;

  return rows.map((r) => ({
    month: r.month,
    income: r.income,
    bankExpenses: r.bank_expenses,
    ccExpenses: r.cc_expenses,
    ccCharge: r.cc_charge,
    net: r.net,
    transactionCount: r.transaction_count,
  }));
}

// ---------------------------------------------------------------------------
// Category report
// ---------------------------------------------------------------------------

export interface CategoryRow {
  category: string;
  totalAmount: number;
  transactionCount: number;
  percentage: number;
}

export function getCategoryReport(
  range: DateRange,
  providerType?: string,
): CategoryRow[] {
  const db = getDatabase();
  const { conditions, params } = buildDateConditions(range, providerType);
  params.$ccBilling = CC_BILLING_CATEGORY;

  // Expenses only, excluding CC billing (internal transfers)
  conditions.push("t.charged_amount < 0");
  conditions.push("COALESCE(t.category, '') != $ccBilling");

  const sql = `
    SELECT
      COALESCE(t.category, 'Uncategorized') AS category,
      SUM(ABS(t.charged_amount)) AS total_amount,
      COUNT(*) AS transaction_count
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    JOIN providers p ON a.provider_id = p.id
    ${whereClause(conditions)}
    GROUP BY category
    ORDER BY total_amount DESC
  `;

  const rows = db.prepare(sql).all(params) as Array<{
    category: string;
    total_amount: number;
    transaction_count: number;
  }>;

  // Calculate percentages
  const totalSpend = rows.reduce((sum, r) => sum + r.total_amount, 0);

  return rows.map((r) => ({
    category: r.category,
    totalAmount: r.total_amount,
    transactionCount: r.transaction_count,
    percentage: totalSpend > 0 ? Math.round((r.total_amount / totalSpend) * 10000) / 100 : 0,
  }));
}

// ---------------------------------------------------------------------------
// Merchant report
// ---------------------------------------------------------------------------

export interface MerchantRow {
  merchant: string;
  totalAmount: number;
  transactionCount: number;
  averageAmount: number;
}

export function getMerchantReport(
  range: DateRange,
  limit: number = 20,
  providerType?: string,
): MerchantRow[] {
  const db = getDatabase();
  const { conditions, params } = buildDateConditions(range, providerType);
  params.$ccBilling = CC_BILLING_CATEGORY;

  // Expenses only, excluding CC billing (internal transfers)
  conditions.push("t.charged_amount < 0");
  conditions.push("COALESCE(t.category, '') != $ccBilling");

  params.$limit = limit;

  const sql = `
    SELECT
      COALESCE(t.description_en, t.description) AS merchant,
      SUM(ABS(t.charged_amount)) AS total_amount,
      COUNT(*) AS transaction_count,
      ROUND(AVG(ABS(t.charged_amount)), 2) AS average_amount
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    JOIN providers p ON a.provider_id = p.id
    ${whereClause(conditions)}
    GROUP BY merchant
    ORDER BY total_amount DESC
    LIMIT $limit
  `;

  const rows = db.prepare(sql).all(params) as Array<{
    merchant: string;
    total_amount: number;
    transaction_count: number;
    average_amount: number;
  }>;

  return rows.map((r) => ({
    merchant: r.merchant,
    totalAmount: r.total_amount,
    transactionCount: r.transaction_count,
    averageAmount: r.average_amount,
  }));
}

// ---------------------------------------------------------------------------
// Balance report
// ---------------------------------------------------------------------------

export interface BalanceRow {
  provider: string;
  providerAlias: string;
  providerType: string;
  accountNumber: string;
  balance: number | null;
  currency: string;
  lastSyncedAt: string | null;
  recentExpenses30d: number;
  recentIncome30d: number;
}

export function getBalanceReport(): BalanceRow[] {
  const db = getDatabase();

  const sql = `
    SELECT
      p.display_name AS provider,
      p.alias AS provider_alias,
      p.type AS provider_type,
      a.account_number,
      a.balance,
      a.currency,
      (SELECT MAX(sl.completed_at) FROM sync_log sl WHERE sl.provider_id = p.id) AS last_synced_at,
      COALESCE(
        (SELECT SUM(ABS(t2.charged_amount))
         FROM transactions t2
         WHERE t2.account_id = a.id
           AND t2.charged_amount < 0
           AND COALESCE(t2.category, '') != 'CC Billing'
           AND t2.date >= date('now', '-30 days')),
        0
      ) AS recent_expenses_30d,
      COALESCE(
        (SELECT SUM(t3.charged_amount)
         FROM transactions t3
         WHERE t3.account_id = a.id
           AND t3.charged_amount > 0
           AND t3.date >= date('now', '-30 days')),
        0
      ) AS recent_income_30d
    FROM accounts a
    JOIN providers p ON a.provider_id = p.id
    ORDER BY p.type, p.display_name, a.account_number
  `;

  const rows = db.prepare(sql).all() as Array<{
    provider: string;
    provider_alias: string;
    provider_type: string;
    account_number: string;
    balance: number | null;
    currency: string;
    last_synced_at: string | null;
    recent_expenses_30d: number;
    recent_income_30d: number;
  }>;

  return rows.map((r) => ({
    provider: r.provider,
    providerAlias: r.provider_alias,
    providerType: r.provider_type,
    accountNumber: r.account_number,
    balance: r.balance,
    currency: r.currency,
    lastSyncedAt: r.last_synced_at,
    recentExpenses30d: r.recent_expenses_30d,
    recentIncome30d: r.recent_income_30d,
  }));
}
