// Query executor — translates composable query primitives into DB calls.
// Each primitive is deeply parameterized; the AI agent varies params to
// express any financial view without needing new query types.

import { getDatabase } from "../db/database.js";
import { buildClassificationExcludeSQL } from "../db/repositories/categories.js";
import { DEFAULT_REPORT_EXCLUDES } from "../types/index.js";
import { getBalanceReport } from "../db/repositories/reports.js";
import { getBudgetVsActual } from "../db/repositories/budgets.js";
import { escapeLike } from "../db/utils.js";
import type { WidgetQuery } from "../core/page-schema.js";

type SqlParams = Record<string, string | number | null>;

// ---------------------------------------------------------------------------
// Shared filter builder
// ---------------------------------------------------------------------------

interface ParsedFilters {
  from: string;
  to: string;
}

function parsePeriod(period?: string): ParsedFilters {
  const now = new Date();
  if (!period || period === "month") {
    // Current month
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    return { from: `${y}-${m}-01`, to: `${y}-${m}-31T23:59:59.999Z` };
  }
  // Relative days: "90d", "30d", etc.
  const daysMatch = period.match(/^(\d+)d$/);
  if (daysMatch) {
    const days = Number(daysMatch[1]);
    const from = new Date(now.getTime() - days * 86400000);
    return {
      from: from.toISOString().slice(0, 10),
      to: now.toISOString().slice(0, 10) + "T23:59:59.999Z",
    };
  }
  // Range: "2026-01/2026-03"
  if (period.includes("/")) {
    const [fromPart, toPart] = period.split("/");
    const fromDate = fromPart.length === 7 ? fromPart + "-01" : fromPart;
    const toDate = toPart.length === 7 ? toPart + "-31T23:59:59.999Z" : toPart + "T23:59:59.999Z";
    return { from: fromDate, to: toDate };
  }
  // Single month: "2026-01"
  if (period.length === 7) {
    return { from: period + "-01", to: period + "-31T23:59:59.999Z" };
  }
  // Single date
  return { from: period, to: period + "T23:59:59.999Z" };
}

interface FilterBuildResult {
  conditions: string[];
  params: SqlParams;
  from: string;
  to: string;
}

function buildFilterConditions(filters?: Record<string, unknown>): FilterBuildResult {
  const f = (filters ?? {}) as Record<string, unknown>;
  const { from, to } = parsePeriod(f.period as string | undefined);
  const conditions: string[] = ["t.date >= $from", "t.date <= $to"];
  const params: SqlParams = { $from: from, $to: to };

  // Direction filter
  const dir = f.direction as string | undefined;
  if (dir === "expense") {
    conditions.push("t.charged_amount < 0");
  } else if (dir === "income") {
    conditions.push("t.charged_amount > 0");
  }

  // Category filter
  const categories = f.category as string[] | undefined;
  if (categories && categories.length > 0) {
    const placeholders = categories.map((_, i) => `$cat_${i}`);
    conditions.push(`COALESCE(t.category, 'Uncategorized') IN (${placeholders.join(", ")})`);
    categories.forEach((c, i) => { params[`$cat_${i}`] = c; });
  }

  // Merchant filter (glob patterns)
  const merchants = f.merchant as string[] | undefined;
  if (merchants && merchants.length > 0) {
    const merchConditions = merchants.map((_, i) => {
      return `COALESCE(t.description_en, t.description) LIKE $merch_${i} ESCAPE '\\'`;
    });
    conditions.push(`(${merchConditions.join(" OR ")})`);
    merchants.forEach((m, i) => {
      // Convert glob * to SQL %
      const pattern = m.replace(/\*/g, "%");
      params[`$merch_${i}`] = pattern.includes("%") ? pattern : `%${escapeLike(m)}%`;
    });
  }

  // Amount range
  if (typeof f.amountMin === "number") {
    conditions.push("ABS(t.charged_amount) >= $amountMin");
    params.$amountMin = f.amountMin;
  }
  if (typeof f.amountMax === "number") {
    conditions.push("ABS(t.charged_amount) <= $amountMax");
    params.$amountMax = f.amountMax;
  }

  // Account filter
  const accounts = f.account as string[] | undefined;
  if (accounts && accounts.length > 0) {
    const placeholders = accounts.map((_, i) => `$acct_${i}`);
    conditions.push(`a.account_number IN (${placeholders.join(", ")})`);
    accounts.forEach((a, i) => { params[`$acct_${i}`] = a; });
  }

  // Transaction type
  const txType = f.type as string | undefined;
  if (txType && txType !== "all") {
    conditions.push("t.type = $txType");
    params.$txType = txType;
  }

  // Default: exclude cc_billing for spending queries
  const { sql: excludeSQL, params: excludeParams } = buildClassificationExcludeSQL(DEFAULT_REPORT_EXCLUDES);
  conditions.push(excludeSQL);
  Object.assign(params, excludeParams);

  return { conditions, params, from, to };
}

// ---------------------------------------------------------------------------
// Aggregate resolver
// ---------------------------------------------------------------------------

interface AggregateResult {
  value: number | null;
  groups?: Array<{ label: string; value: number; count: number; percentage?: number }>;
  comparison?: { previousValue: number; change: number };
}

function executeAggregateQuery(query: Extract<WidgetQuery, { type: "aggregate" }>): AggregateResult {
  const db = getDatabase();
  const { conditions, params, from, to } = buildFilterConditions(query.filters);

  const metric = query.metric ?? "sum";
  const field = query.field === "originalAmount" ? "t.original_amount" : "t.charged_amount";
  const absField = `ABS(${field})`;

  let metricExpr: string;
  switch (metric) {
    case "sum": metricExpr = `SUM(${absField})`; break;
    case "avg": metricExpr = `ROUND(AVG(${absField}), 2)`; break;
    case "count": metricExpr = "COUNT(*)"; break;
    case "min": metricExpr = `MIN(${absField})`; break;
    case "max": metricExpr = `MAX(${absField})`; break;
  }

  if (!query.groupBy) {
    // Single aggregate value
    const sql = `
      SELECT ${metricExpr} AS value, COUNT(*) AS cnt
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      JOIN providers p ON a.provider_id = p.id
      WHERE ${conditions.join(" AND ")}
    `;
    const row = db.prepare(sql).get(params) as { value: number | null; cnt: number };

    let comparison: AggregateResult["comparison"];
    if (query.compareTo === "previous_period") {
      const duration = new Date(to).getTime() - new Date(from).getTime();
      const prevFrom = new Date(new Date(from).getTime() - duration).toISOString().slice(0, 10);
      const prevTo = from;
      const prevParams = { ...params, $from: prevFrom, $to: prevTo };
      const prevRow = db.prepare(sql).get(prevParams) as { value: number | null; cnt: number };
      const prev = prevRow.value ?? 0;
      const curr = row.value ?? 0;
      comparison = {
        previousValue: prev,
        change: prev > 0 ? Math.round(((curr - prev) / prev) * 10000) / 100 : 0,
      };
    }

    return { value: row.value, comparison };
  }

  // Grouped aggregate
  let labelExpr: string;
  switch (query.groupBy) {
    case "category": labelExpr = "COALESCE(t.category, 'Uncategorized')"; break;
    case "merchant": labelExpr = "COALESCE(t.description_en, t.description)"; break;
    case "month": labelExpr = "strftime('%Y-%m', t.date)"; break;
    case "week": labelExpr = "strftime('%Y-W%W', t.date)"; break;
    case "day": labelExpr = "strftime('%Y-%m-%d', t.date)"; break;
    case "account": labelExpr = "a.account_number"; break;
  }

  const sort = query.sort ?? "value_desc";
  let orderBy: string;
  switch (sort) {
    case "value_asc": orderBy = "value ASC"; break;
    case "label_asc": orderBy = "label ASC"; break;
    default: orderBy = "value DESC";
  }

  const limitClause = query.limit ? `LIMIT ${Number(query.limit)}` : "";

  const sql = `
    SELECT ${labelExpr} AS label, ${metricExpr} AS value, COUNT(*) AS cnt
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    JOIN providers p ON a.provider_id = p.id
    WHERE ${conditions.join(" AND ")}
    GROUP BY label
    ORDER BY ${orderBy}
    ${limitClause}
  `;

  const rows = db.prepare(sql).all(params) as Array<{ label: string; value: number; cnt: number }>;
  const total = rows.reduce((s, r) => s + r.value, 0);

  return {
    value: total,
    groups: rows.map((r) => ({
      label: r.label,
      value: r.value,
      count: r.cnt,
      percentage: total > 0 ? Math.round((r.value / total) * 10000) / 100 : 0,
    })),
  };
}

// ---------------------------------------------------------------------------
// Trend resolver
// ---------------------------------------------------------------------------

interface TrendPoint {
  date: string;
  value: number;
  breakdown?: Array<{ label: string; value: number }>;
}

interface TrendResult {
  points: TrendPoint[];
}

function executeTrendQuery(query: Extract<WidgetQuery, { type: "trend" }>): TrendResult {
  const db = getDatabase();
  const { conditions, params } = buildFilterConditions(query.filters);

  const interval = query.interval ?? "month";
  const metric = query.metric ?? "sum";
  const series = query.series ?? "total";

  let dateExpr: string;
  switch (interval) {
    case "day": dateExpr = "strftime('%Y-%m-%d', t.date)"; break;
    case "week": dateExpr = "strftime('%Y-W%W', t.date)"; break;
    default: dateExpr = "strftime('%Y-%m', t.date)";
  }

  let metricExpr: string;
  switch (metric) {
    case "avg": metricExpr = "ROUND(AVG(ABS(t.charged_amount)), 2)"; break;
    case "count": metricExpr = "COUNT(*)"; break;
    default: metricExpr = "SUM(ABS(t.charged_amount))";
  }

  if (series === "total") {
    const sql = `
      SELECT ${dateExpr} AS period, ${metricExpr} AS value
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      JOIN providers p ON a.provider_id = p.id
      WHERE ${conditions.join(" AND ")}
      GROUP BY period
      ORDER BY period ASC
    `;
    const rows = db.prepare(sql).all(params) as Array<{ period: string; value: number }>;
    return { points: rows.map((r) => ({ date: r.period, value: r.value })) };
  }

  // Breakdown by category or merchant
  const labelExpr = series === "category"
    ? "COALESCE(t.category, 'Uncategorized')"
    : "COALESCE(t.description_en, t.description)";

  const sql = `
    SELECT ${dateExpr} AS period, ${labelExpr} AS label, ${metricExpr} AS value
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    JOIN providers p ON a.provider_id = p.id
    WHERE ${conditions.join(" AND ")}
    GROUP BY period, label
    ORDER BY period ASC, value DESC
  `;

  const rows = db.prepare(sql).all(params) as Array<{ period: string; label: string; value: number }>;

  // Group by period
  const byPeriod = new Map<string, Array<{ label: string; value: number }>>();
  for (const r of rows) {
    if (!byPeriod.has(r.period)) byPeriod.set(r.period, []);
    byPeriod.get(r.period)!.push({ label: r.label, value: r.value });
  }

  return {
    points: [...byPeriod.entries()].map(([date, breakdown]) => ({
      date,
      value: breakdown.reduce((s, b) => s + b.value, 0),
      breakdown,
    })),
  };
}

// ---------------------------------------------------------------------------
// Transactions resolver
// ---------------------------------------------------------------------------

interface TransactionsResult {
  rows: Array<{
    id: number;
    date: string;
    description: string;
    descriptionEn: string | null;
    category: string | null;
    chargedAmount: number;
    provider: string;
    account: string;
  }>;
  total: number;
}

function executeTransactionsQuery(query: Extract<WidgetQuery, { type: "transactions" }>): TransactionsResult {
  const db = getDatabase();
  const { conditions, params } = buildFilterConditions(query.filters);

  const sortMap: Record<string, string> = {
    date_desc: "t.date DESC",
    date_asc: "t.date ASC",
    amount_desc: "ABS(t.charged_amount) DESC",
    amount_asc: "ABS(t.charged_amount) ASC",
  };
  const orderBy = sortMap[query.sort ?? "date_desc"];
  const limit = Math.min(query.limit ?? 50, 500);
  const offset = query.offset ?? 0;

  const countSql = `
    SELECT COUNT(*) AS total
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    JOIN providers p ON a.provider_id = p.id
    WHERE ${conditions.join(" AND ")}
  `;

  const sql = `
    SELECT
      t.id, t.date, t.description, t.description_en, t.category,
      t.charged_amount, p.alias AS provider, a.account_number AS account
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    JOIN providers p ON a.provider_id = p.id
    WHERE ${conditions.join(" AND ")}
    ORDER BY ${orderBy}
    LIMIT $limit OFFSET $offset
  `;

  const countRow = db.prepare(countSql).get(params) as { total: number };
  const rows = db.prepare(sql).all({ ...params, $limit: limit, $offset: offset }) as Array<{
    id: number;
    date: string;
    description: string;
    description_en: string | null;
    category: string | null;
    charged_amount: number;
    provider: string;
    account: string;
  }>;

  return {
    rows: rows.map((r) => ({
      id: r.id,
      date: r.date,
      description: r.description,
      descriptionEn: r.description_en,
      category: r.category,
      chargedAmount: r.charged_amount,
      provider: r.provider,
      account: r.account,
    })),
    total: countRow.total,
  };
}

// ---------------------------------------------------------------------------
// Balances resolver
// ---------------------------------------------------------------------------

function executeBalancesQuery(query: Extract<WidgetQuery, { type: "balances" }>) {
  const accounts = getBalanceReport();
  if (query.account && query.account.length > 0) {
    return { accounts: accounts.filter((a) => query.account!.includes(a.accountNumber)) };
  }
  return { accounts };
}

// ---------------------------------------------------------------------------
// Budget vs actual resolver
// ---------------------------------------------------------------------------

function executeBudgetVsActualQuery(query: Extract<WidgetQuery, { type: "budget_vs_actual" }>) {
  const now = new Date();
  const month = query.month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return { items: getBudgetVsActual(month) };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type QueryResult = unknown;

export function executeQuery(query: WidgetQuery): QueryResult {
  switch (query.type) {
    case "aggregate": return executeAggregateQuery(query);
    case "trend": return executeTrendQuery(query);
    case "transactions": return executeTransactionsQuery(query);
    case "balances": return executeBalancesQuery(query);
    case "budget_vs_actual": return executeBudgetVsActualQuery(query);
  }
}

// Batch resolve multiple queries
export function executeQueryBatch(
  queries: Array<{ key: string; query: WidgetQuery }>,
): Record<string, QueryResult> {
  const results: Record<string, QueryResult> = {};
  for (const { key, query } of queries) {
    try {
      results[key] = executeQuery(query);
    } catch (err) {
      results[key] = { error: err instanceof Error ? err.message : String(err) };
    }
  }
  return results;
}
