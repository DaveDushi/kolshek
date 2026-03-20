// Reconciliation repository — fuzzy duplicate queries, decisions, balance computation.

import { getDatabase } from "../database.js";
import type {
  DuplicateTxSummary,
  FuzzyMatchConfig,
  ReconciliationDecision,
  ReconciliationRecord,
} from "../../types/index.js";

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

interface CandidatePairRow {
  a_id: number;
  a_date: string;
  a_description: string;
  a_description_en: string | null;
  a_charged_amount: number;
  a_charged_currency: string | null;
  a_status: string;
  a_category: string | null;
  a_provider_alias: string;
  a_account_number: string;
  b_id: number;
  b_date: string;
  b_description: string;
  b_description_en: string | null;
  b_charged_amount: number;
  b_charged_currency: string | null;
  b_status: string;
  b_category: string | null;
  b_provider_alias: string;
  b_account_number: string;
}

interface DecisionRow {
  id: number;
  tx_id_a: number;
  tx_id_b: number;
  decision: string;
  score: number;
  merged_into_tx_id: number | null;
  decided_at: string;
  notes: string | null;
}

// ---------------------------------------------------------------------------
// Find fuzzy duplicate candidate pairs (pre-filtered by SQL)
// ---------------------------------------------------------------------------

export function findFuzzyDuplicateCandidates(
  config: FuzzyMatchConfig,
  filters?: { from?: string; to?: string; accountId?: number },
): { txA: DuplicateTxSummary; txB: DuplicateTxSummary }[] {
  const db = getDatabase();

  const conditions: string[] = [
    "t2.id > t1.id",
    "ABS(t1.charged_amount - t2.charged_amount) <= $tolerance",
    "ABS(julianday(t1.date) - julianday(t2.date)) <= $dateWindow",
    "t1.hash != t2.hash",
  ];
  const params: Record<string, string | number | null> = {
    $tolerance: config.amountTolerance,
    $dateWindow: config.dateWindowDays,
    $crossAccount: config.crossAccount ? 1 : 0,
  };

  if (!config.crossAccount) {
    conditions.push("t1.account_id = t2.account_id");
  }

  if (filters?.from) {
    conditions.push("t1.date >= $from AND t2.date >= $from");
    params.$from = filters.from;
  }
  if (filters?.to) {
    conditions.push("t1.date <= $to AND t2.date <= $to");
    params.$to = filters.to;
  }
  if (filters?.accountId) {
    conditions.push("t1.account_id = $accountId");
    params.$accountId = filters.accountId;
  }

  const sql = `
    SELECT
      t1.id AS a_id, t1.date AS a_date, t1.description AS a_description,
      t1.description_en AS a_description_en, t1.charged_amount AS a_charged_amount,
      t1.charged_currency AS a_charged_currency, t1.status AS a_status,
      t1.category AS a_category, p1.alias AS a_provider_alias, a1.account_number AS a_account_number,
      t2.id AS b_id, t2.date AS b_date, t2.description AS b_description,
      t2.description_en AS b_description_en, t2.charged_amount AS b_charged_amount,
      t2.charged_currency AS b_charged_currency, t2.status AS b_status,
      t2.category AS b_category, p2.alias AS b_provider_alias, a2.account_number AS b_account_number
    FROM transactions t1
    JOIN accounts a1 ON a1.id = t1.account_id
    JOIN providers p1 ON p1.id = a1.provider_id
    JOIN transactions t2 ON ${conditions.join(" AND ")}
    JOIN accounts a2 ON a2.id = t2.account_id
    JOIN providers p2 ON p2.id = a2.provider_id
    LEFT JOIN reconciliation_decisions rd
      ON rd.tx_id_a = MIN(t1.id, t2.id) AND rd.tx_id_b = MAX(t1.id, t2.id)
    WHERE rd.id IS NULL
    ORDER BY t1.date DESC
    LIMIT 500
  `;

  const rows = db.prepare(sql).all(params) as CandidatePairRow[];

  return rows.map((r) => ({
    txA: {
      id: r.a_id,
      date: r.a_date,
      description: r.a_description,
      descriptionEn: r.a_description_en,
      chargedAmount: r.a_charged_amount,
      chargedCurrency: r.a_charged_currency,
      status: r.a_status,
      category: r.a_category,
      providerAlias: r.a_provider_alias,
      accountNumber: r.a_account_number,
    },
    txB: {
      id: r.b_id,
      date: r.b_date,
      description: r.b_description,
      descriptionEn: r.b_description_en,
      chargedAmount: r.b_charged_amount,
      chargedCurrency: r.b_charged_currency,
      status: r.b_status,
      category: r.b_category,
      providerAlias: r.b_provider_alias,
      accountNumber: r.b_account_number,
    },
  }));
}

// ---------------------------------------------------------------------------
// Record a reconciliation decision
// ---------------------------------------------------------------------------

export function recordReconciliationDecision(
  txIdA: number,
  txIdB: number,
  decision: ReconciliationDecision,
  score: number,
  mergedIntoTxId?: number,
  notes?: string,
): ReconciliationRecord {
  const db = getDatabase();

  // Canonical ordering
  const a = Math.min(txIdA, txIdB);
  const b = Math.max(txIdA, txIdB);

  const row = db
    .prepare(
      `INSERT INTO reconciliation_decisions (tx_id_a, tx_id_b, decision, score, merged_into_tx_id, notes)
       VALUES ($a, $b, $decision, $score, $mergedInto, $notes)
       RETURNING *`,
    )
    .get({
      $a: a,
      $b: b,
      $decision: decision,
      $score: score,
      $mergedInto: mergedIntoTxId ?? null,
      $notes: notes ?? null,
    }) as DecisionRow;

  return rowToRecord(row);
}

// ---------------------------------------------------------------------------
// Merge duplicate (delete one, record decision)
// ---------------------------------------------------------------------------

export function mergeDuplicate(
  keepTxId: number,
  deleteTxId: number,
  score: number,
  notes?: string,
): { merged: boolean; decision: ReconciliationRecord } {
  const db = getDatabase();

  db.run("BEGIN");
  try {
    db.prepare("DELETE FROM transactions WHERE id = $id").run({ $id: deleteTxId });

    const decision = recordReconciliationDecision(
      keepTxId,
      deleteTxId,
      "merged",
      score,
      keepTxId,
      notes,
    );

    db.run("COMMIT");
    return { merged: true, decision };
  } catch (err) {
    db.run("ROLLBACK");
    throw err;
  }
}

// ---------------------------------------------------------------------------
// List reconciliation history
// ---------------------------------------------------------------------------

export function listReconciliationDecisions(
  filters?: { decision?: ReconciliationDecision; limit?: number },
): ReconciliationRecord[] {
  const db = getDatabase();
  const conditions: string[] = [];
  const params: Record<string, string | number | null> = {};

  if (filters?.decision) {
    conditions.push("decision = $decision");
    params.$decision = filters.decision;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = filters?.limit ?? 50;

  const rows = db
    .prepare(
      `SELECT * FROM reconciliation_decisions ${where} ORDER BY decided_at DESC LIMIT $limit`,
    )
    .all({ ...params, $limit: limit }) as DecisionRow[];

  return rows.map(rowToRecord);
}

// ---------------------------------------------------------------------------
// Balance reconciliation
// ---------------------------------------------------------------------------

export function computeAccountBalance(
  accountId: number,
  from?: string,
  to?: string,
): { sum: number; count: number; from: string; to: string } {
  const db = getDatabase();

  const conditions = ["account_id = $accountId"];
  const params: Record<string, string | number | null> = { $accountId: accountId };

  if (from) {
    conditions.push("date >= $from");
    params.$from = from;
  }
  if (to) {
    conditions.push("date <= $to");
    params.$to = to;
  }

  const where = conditions.join(" AND ");

  const result = db
    .prepare(
      `SELECT COALESCE(SUM(charged_amount), 0) AS total, COUNT(*) AS cnt,
              MIN(date) AS min_date, MAX(date) AS max_date
       FROM transactions WHERE ${where}`,
    )
    .get(params) as { total: number; cnt: number; min_date: string | null; max_date: string | null };

  return {
    sum: result.total,
    count: result.cnt,
    from: result.min_date ?? "",
    to: result.max_date ?? "",
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rowToRecord(row: DecisionRow): ReconciliationRecord {
  return {
    id: row.id,
    txIdA: row.tx_id_a,
    txIdB: row.tx_id_b,
    decision: row.decision as ReconciliationDecision,
    score: row.score,
    mergedIntoTxId: row.merged_into_tx_id,
    decidedAt: row.decided_at,
    notes: row.notes,
  };
}
