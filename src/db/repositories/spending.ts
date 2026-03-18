// Spending analysis queries — grouped expense breakdowns by month.

import { getDatabase } from "../database.js";
import { buildClassificationExcludeSQL } from "./categories.js";
import { DEFAULT_SPENDING_EXCLUDES } from "../../types/index.js";

export type SpendingGroupBy = "category" | "merchant" | "provider";

export interface SpendingGroup {
  label: string;
  totalAmount: number;
  transactionCount: number;
  percentage: number;
}

export interface SpendingSummary {
  totalExpenses: number;
  transactionCount: number;
  avgPerDay: number;
  daysInRange: number;
}

export interface SpendingResult {
  groups: SpendingGroup[];
  summary: SpendingSummary;
}

export interface SpendingOpts {
  from: string;
  to: string;
  groupBy: SpendingGroupBy;
  category?: string;
  providerType?: string;
  top?: number;
  excludeClassifications?: readonly string[];
}

export function getSpendingReport(opts: SpendingOpts): SpendingResult {
  const db = getDatabase();
  const params: Record<string, string | number> = {
    $from: opts.from,
    $to: opts.to,
  };

  const excludeClassifications = opts.excludeClassifications ?? DEFAULT_SPENDING_EXCLUDES;
  const { sql: excludeSQL, params: excludeParams } = buildClassificationExcludeSQL(excludeClassifications);
  Object.assign(params, excludeParams);

  const conditions = [
    "t.charged_amount < 0",
    "t.date >= $from",
    "t.date <= $to",
    excludeSQL,
  ];

  if (opts.category) {
    conditions.push("COALESCE(t.category, 'Uncategorized') = $category");
    params.$category = opts.category;
  }
  if (opts.providerType) {
    conditions.push("p.type = $providerType");
    params.$providerType = opts.providerType;
  }

  let labelExpr: string;
  switch (opts.groupBy) {
    case "merchant":
      labelExpr = "COALESCE(t.description_en, t.description)";
      break;
    case "provider":
      labelExpr = "p.alias";
      break;
    default:
      labelExpr = "COALESCE(t.category, 'Uncategorized')";
  }

  const limitClause = opts.top ? `LIMIT ${Number(opts.top)}` : "";

  const sql = `
    SELECT
      ${labelExpr} AS label,
      SUM(ABS(t.charged_amount)) AS total_amount,
      COUNT(*) AS transaction_count
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    JOIN providers p ON a.provider_id = p.id
    WHERE ${conditions.join(" AND ")}
    GROUP BY label
    ORDER BY total_amount DESC
    ${limitClause}
  `;

  const rows = db.prepare(sql).all(params) as Array<{
    label: string;
    total_amount: number;
    transaction_count: number;
  }>;

  const totalExpenses = rows.reduce((s, r) => s + r.total_amount, 0);
  const totalTxns = rows.reduce((s, r) => s + r.transaction_count, 0);

  const fromDate = new Date(opts.from);
  const toDate = new Date(opts.to);
  const daysInRange = Math.max(1, Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);

  return {
    groups: rows.map((r) => ({
      label: r.label,
      totalAmount: r.total_amount,
      transactionCount: r.transaction_count,
      percentage: totalExpenses > 0 ? Math.round((r.total_amount / totalExpenses) * 10000) / 100 : 0,
    })),
    summary: {
      totalExpenses,
      transactionCount: totalTxns,
      avgPerDay: Math.round((totalExpenses / daysInRange) * 100) / 100,
      daysInRange,
    },
  };
}
