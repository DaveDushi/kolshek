import type {
  TransactionInput,
  TransactionWithContext,
  TransactionFilters,
} from "../../types/index.js";
import { getDatabase } from "../database.js";

/** Escape SQL LIKE wildcards so they are treated as literals. */
function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, "\\$&");
}

interface TransactionWithContextRow {
  id: number;
  account_id: number;
  type: string;
  identifier: string | null;
  date: string;
  processed_date: string;
  original_amount: number;
  original_currency: string;
  charged_amount: number;
  charged_currency: string | null;
  description: string;
  description_en: string | null;
  memo: string | null;
  status: string;
  installment_number: number | null;
  installment_total: number | null;
  category: string | null;
  hash: string;
  unique_id: string;
  created_at: string;
  updated_at: string;
  provider_display_name: string;
  provider_company_id: string;
  account_number: string;
}

function rowToTransactionWithContext(
  row: TransactionWithContextRow,
): TransactionWithContext {
  return {
    id: row.id,
    accountId: row.account_id,
    type: row.type as TransactionWithContext["type"],
    identifier: row.identifier,
    date: row.date,
    processedDate: row.processed_date,
    originalAmount: row.original_amount,
    originalCurrency: row.original_currency,
    chargedAmount: row.charged_amount,
    chargedCurrency: row.charged_currency,
    description: row.description,
    descriptionEn: row.description_en,
    memo: row.memo,
    status: row.status as TransactionWithContext["status"],
    installmentNumber: row.installment_number,
    installmentTotal: row.installment_total,
    category: row.category,
    hash: row.hash,
    uniqueId: row.unique_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    providerDisplayName: row.provider_display_name,
    providerCompanyId: row.provider_company_id,
    accountNumber: row.account_number,
  };
}

export function upsertTransaction(
  input: TransactionInput,
): { action: "inserted" | "updated" | "unchanged" } {
  const db = getDatabase();

  // Check if the transaction already exists
  const existing = db
    .prepare(
      "SELECT id, status FROM transactions WHERE account_id = $accountId AND hash = $hash",
    )
    .get({ $accountId: input.accountId, $hash: input.hash }) as
    | { id: number; status: string }
    | null;

  if (!existing) {
    db.prepare(
      `INSERT INTO transactions (
        account_id, type, identifier, date, processed_date,
        original_amount, original_currency, charged_amount, charged_currency,
        description, description_en, memo, status, installment_number, installment_total,
        category, hash, unique_id
      ) VALUES (
        $accountId, $type, $identifier, $date, $processedDate,
        $originalAmount, $originalCurrency, $chargedAmount, $chargedCurrency,
        $description, $descriptionEn, $memo, $status, $installmentNumber, $installmentTotal,
        $category, $hash, $uniqueId
      )`,
    ).run({
      $accountId: input.accountId,
      $type: input.type,
      $identifier: input.identifier ?? null,
      $date: input.date,
      $processedDate: input.processedDate,
      $originalAmount: input.originalAmount,
      $originalCurrency: input.originalCurrency,
      $chargedAmount: input.chargedAmount,
      $chargedCurrency: input.chargedCurrency ?? null,
      $description: input.description,
      $descriptionEn: input.descriptionEn ?? null,
      $memo: input.memo ?? null,
      $status: input.status,
      $installmentNumber: input.installmentNumber ?? null,
      $installmentTotal: input.installmentTotal ?? null,
      $category: input.category ?? null,
      $hash: input.hash,
      $uniqueId: input.uniqueId,
    });
    return { action: "inserted" };
  }

  if (existing.status !== input.status) {
    // On status change (e.g. pending→completed), update all mutable fields
    db.prepare(
      `UPDATE transactions
       SET status = $status,
           processed_date = $processedDate,
           charged_amount = $chargedAmount,
           charged_currency = $chargedCurrency,
           original_amount = $originalAmount,
           original_currency = $originalCurrency,
           updated_at = datetime('now')
       WHERE id = $id`,
    ).run({
      $id: existing.id,
      $status: input.status,
      $processedDate: input.processedDate,
      $chargedAmount: input.chargedAmount,
      $chargedCurrency: input.chargedCurrency ?? null,
      $originalAmount: input.originalAmount,
      $originalCurrency: input.originalCurrency,
    });
    return { action: "updated" };
  }

  return { action: "unchanged" };
}

/**
 * Build the base query with JOINs for TransactionWithContext results.
 */
function buildContextQuery(
  whereClause: string,
  orderClause: string,
  limitClause: string,
): string {
  return `
    SELECT
      t.*,
      p.display_name AS provider_display_name,
      p.company_id AS provider_company_id,
      a.account_number
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    JOIN providers p ON a.provider_id = p.id
    ${whereClause}
    ${orderClause}
    ${limitClause}
  `;
}

/**
 * Build WHERE clause and params from TransactionFilters.
 */
type SqlParams = Record<string, string | number | null>;

function buildFilterClauses(filters: TransactionFilters): {
  conditions: string[];
  params: SqlParams;
} {
  const conditions: string[] = [];
  const params: SqlParams = {};

  if (filters.from) {
    conditions.push("t.date >= $from");
    params.$from = filters.from;
  }
  if (filters.to) {
    conditions.push("t.date <= $to");
    // Append end-of-day so date-only filters include the full day
    params.$to = filters.to.length === 10 ? filters.to + "T23:59:59.999Z" : filters.to;
  }
  if (filters.providerId !== undefined) {
    conditions.push("a.provider_id = $providerId");
    params.$providerId = filters.providerId;
  }
  if (filters.providerCompanyId) {
    conditions.push("p.company_id = $providerCompanyId");
    params.$providerCompanyId = filters.providerCompanyId;
  }
  if (filters.providerType) {
    conditions.push("p.type = $providerType");
    params.$providerType = filters.providerType;
  }
  if (filters.accountId !== undefined) {
    conditions.push("t.account_id = $accountId");
    params.$accountId = filters.accountId;
  }
  if (filters.accountNumber) {
    conditions.push("a.account_number = $accountNumber");
    params.$accountNumber = filters.accountNumber;
  }
  if (filters.minAmount !== undefined) {
    conditions.push("t.charged_amount >= $minAmount");
    params.$minAmount = filters.minAmount;
  }
  if (filters.maxAmount !== undefined) {
    conditions.push("t.charged_amount <= $maxAmount");
    params.$maxAmount = filters.maxAmount;
  }
  if (filters.status) {
    conditions.push("t.status = $status");
    params.$status = filters.status;
  }
  if (filters.description) {
    conditions.push("t.description LIKE $description ESCAPE '\\'");
    params.$description = `%${escapeLike(filters.description)}%`;
  }

  return { conditions, params };
}

export function listTransactions(
  filters: TransactionFilters,
): TransactionWithContext[] {
  const db = getDatabase();
  const { conditions, params } = buildFilterClauses(filters);

  const whereClause =
    conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

  const sortCol =
    filters.sort === "amount" ? "t.charged_amount" : "t.date";
  const sortDir = filters.sortDirection === "asc" ? "ASC" : "DESC";
  const orderClause = `ORDER BY ${sortCol} ${sortDir}`;

  let limitClause = "";
  if (filters.limit !== undefined) {
    limitClause = "LIMIT $limit";
    params.$limit = filters.limit;
    if (filters.offset !== undefined) {
      limitClause += " OFFSET $offset";
      params.$offset = filters.offset;
    }
  }

  const sql = buildContextQuery(whereClause, orderClause, limitClause);
  const rows = db.prepare(sql).all(params) as TransactionWithContextRow[];

  return rows.map(rowToTransactionWithContext);
}

export function searchTransactions(
  query: string,
  filters?: TransactionFilters,
): TransactionWithContext[] {
  const db = getDatabase();
  // Clear description filter to avoid double-applying with the search query
  if (filters?.description) {
    filters = { ...filters, description: undefined };
  }
  const { conditions, params } = buildFilterClauses(filters ?? {});

  conditions.push("t.description LIKE $searchQuery ESCAPE '\\'");
  params.$searchQuery = `%${escapeLike(query)}%`;

  const whereClause = "WHERE " + conditions.join(" AND ");

  const sortCol =
    filters?.sort === "amount" ? "t.charged_amount" : "t.date";
  const sortDir = filters?.sortDirection === "asc" ? "ASC" : "DESC";
  const orderClause = `ORDER BY ${sortCol} ${sortDir}`;

  let limitClause = "";
  if (filters?.limit !== undefined) {
    limitClause = "LIMIT $limit";
    params.$limit = filters.limit;
    if (filters.offset !== undefined) {
      limitClause += " OFFSET $offset";
      params.$offset = filters.offset;
    }
  }

  const sql = buildContextQuery(whereClause, orderClause, limitClause);
  const rows = db.prepare(sql).all(params) as TransactionWithContextRow[];

  return rows.map(rowToTransactionWithContext);
}

export function countTransactions(filters?: TransactionFilters): number {
  const db = getDatabase();
  const { conditions, params } = buildFilterClauses(filters ?? {});

  const whereClause =
    conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

  const sql = `
    SELECT COUNT(*) AS count
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    JOIN providers p ON a.provider_id = p.id
    ${whereClause}
  `;

  const row = db.prepare(sql).get(params) as { count: number };
  return row.count;
}
