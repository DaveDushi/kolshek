// Category rule CRUD and application logic.
// Rules use a JSON conditions column for multi-field matching.

import { getDatabase } from "../database.js";
import type {
  RuleConditions,
  CategoryRule,
  CategoryRuleInput,
  TransactionForMatching,
} from "../../types/index.js";
import { applyRules as applyRulesEngine } from "../../core/rules.js";

// ---------------------------------------------------------------------------
// DB row type and mapper
// ---------------------------------------------------------------------------

interface CategoryRuleRow {
  id: number;
  category: string;
  conditions: string; // JSON string
  priority: number;
  created_at: string;
}

function rowToRule(row: CategoryRuleRow): CategoryRule {
  return {
    id: row.id,
    category: row.category,
    conditions: JSON.parse(row.conditions) as RuleConditions,
    priority: row.priority,
    createdAt: row.created_at,
  };
}

// Deterministic JSON serialization for dedup comparisons.
function serializeConditions(conditions: RuleConditions): string {
  const sorted: Record<string, unknown> = {};
  // Fixed key order
  if (conditions.description) sorted.description = conditions.description;
  if (conditions.memo) sorted.memo = conditions.memo;
  if (conditions.account) sorted.account = conditions.account;
  if (conditions.amount) sorted.amount = conditions.amount;
  if (conditions.direction) sorted.direction = conditions.direction;
  return JSON.stringify(sorted);
}

// Escape SQL LIKE wildcards so they are treated as literals.
function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, "\\$&");
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export function addCategoryRule(
  category: string,
  conditions: RuleConditions,
  priority: number = 0,
): CategoryRule {
  const db = getDatabase();
  const conditionsJson = serializeConditions(conditions);
  const result = db
    .prepare(
      "INSERT INTO category_rules (category, conditions, priority) VALUES ($category, $conditions, $priority)",
    )
    .run({ $category: category, $conditions: conditionsJson, $priority: priority });

  const row = db
    .prepare("SELECT * FROM category_rules WHERE id = $id")
    .get({ $id: result.lastInsertRowid }) as CategoryRuleRow;

  return rowToRule(row);
}

export function listCategoryRules(): CategoryRule[] {
  const db = getDatabase();
  const rows = db
    .prepare("SELECT * FROM category_rules ORDER BY priority DESC, id ASC")
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

// ---------------------------------------------------------------------------
// Apply rules to transactions (in-memory evaluation with scope/dry-run)
// ---------------------------------------------------------------------------

interface TxRow {
  id: number;
  description: string;
  description_en: string | null;
  memo: string | null;
  charged_amount: number;
  provider_alias: string;
  account_number: string;
}

export interface ApplyRulesOptions {
  scope?: "uncategorized" | "all" | "from-category";
  fromCategory?: string;
  dryRun?: boolean;
}

export interface ApplyRulesResult {
  applied: number;
  uncategorized: number;
  dryRun: boolean;
  scope: string;
  fromCategory?: string;
}

export function applyCategoryRules(options?: ApplyRulesOptions): ApplyRulesResult {
  const db = getDatabase();
  const scope = options?.scope ?? "uncategorized";
  const dryRun = options?.dryRun ?? false;
  const fromCategory = options?.fromCategory;

  // 1. Fetch rules in evaluation order
  const ruleRows = db
    .prepare("SELECT * FROM category_rules ORDER BY priority DESC, id ASC")
    .all() as CategoryRuleRow[];
  const rules = ruleRows.map(rowToRule);

  // 2. Build category filter based on scope
  let categoryFilter: string;
  const params: Record<string, string> = {};

  if (scope === "all") {
    categoryFilter = "";
  } else if (scope === "from-category") {
    categoryFilter = "AND t.category = $fromCategory";
    params.$fromCategory = fromCategory!;
  } else {
    categoryFilter = "AND (t.category IS NULL OR t.category = 'Uncategorized')";
  }

  // 3. Fetch transactions with account/provider context
  const txRows = db
    .prepare(
      `SELECT
         t.id, t.description, t.description_en, t.memo, t.charged_amount,
         p.alias AS provider_alias,
         a.account_number
       FROM transactions t
       JOIN accounts a ON t.account_id = a.id
       JOIN providers p ON a.provider_id = p.id
       WHERE 1=1 ${categoryFilter}`,
    )
    .all(params) as TxRow[];

  const transactions: TransactionForMatching[] = txRows.map((r) => ({
    id: r.id,
    description: r.description,
    descriptionEn: r.description_en,
    memo: r.memo,
    chargedAmount: r.charged_amount,
    providerAlias: r.provider_alias,
    accountNumber: r.account_number,
  }));

  // 4. Evaluate rules in-memory
  const assignments = applyRulesEngine(rules, transactions);

  // 5. Apply or count
  let applied = 0;
  if (assignments.size > 0) {
    if (dryRun) {
      applied = assignments.size;
    } else {
      const updateStmt = db.prepare(
        "UPDATE transactions SET category = $category, updated_at = datetime('now') WHERE id = $id",
      );
      db.run("BEGIN");
      try {
        for (const [txId, category] of assignments) {
          updateStmt.run({ $id: txId, $category: category });
          applied++;
        }
        db.run("COMMIT");
      } catch (err) {
        db.run("ROLLBACK");
        throw err;
      }
    }
  }

  // 6. Set remaining NULLs to 'Uncategorized' (skip for from-category scope)
  let uncategorized = 0;
  if (scope !== "from-category") {
    if (dryRun) {
      const row = db
        .prepare("SELECT COUNT(*) AS count FROM transactions WHERE category IS NULL")
        .get() as { count: number };
      uncategorized = row.count;
    } else {
      const uncatResult = db
        .prepare(
          "UPDATE transactions SET category = 'Uncategorized', updated_at = datetime('now') WHERE category IS NULL",
        )
        .run();
      uncategorized = uncatResult.changes;
    }
  }

  const result: ApplyRulesResult = { applied, uncategorized, dryRun, scope };
  if (scope === "from-category") {
    result.fromCategory = fromCategory;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Category summary
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Category rename / merge
// ---------------------------------------------------------------------------

export interface RenameResult {
  transactionsUpdated: number;
  rulesUpdated: number;
}

export function renameCategory(oldName: string, newName: string): RenameResult {
  const db = getDatabase();
  db.run("BEGIN");
  try {
    const txResult = db
      .prepare(
        "UPDATE transactions SET category = $new, updated_at = datetime('now') WHERE category = $old",
      )
      .run({ $old: oldName, $new: newName });

    const ruleResult = db
      .prepare("UPDATE category_rules SET category = $new WHERE category = $old")
      .run({ $old: oldName, $new: newName });

    db.run("COMMIT");
    return {
      transactionsUpdated: txResult.changes,
      rulesUpdated: ruleResult.changes,
    };
  } catch (err) {
    db.run("ROLLBACK");
    throw err;
  }
}

export function renameCategoryDryRun(
  oldName: string,
  newName: string,
): { transactionsAffected: number; rulesAffected: number } {
  const db = getDatabase();
  void newName;

  const txRow = db
    .prepare("SELECT COUNT(*) AS count FROM transactions WHERE category = $old")
    .get({ $old: oldName }) as { count: number };

  const ruleRow = db
    .prepare("SELECT COUNT(*) AS count FROM category_rules WHERE category = $old")
    .get({ $old: oldName }) as { count: number };

  return {
    transactionsAffected: txRow.count,
    rulesAffected: ruleRow.count,
  };
}

// ---------------------------------------------------------------------------
// Bulk category migration
// ---------------------------------------------------------------------------

export interface BulkMigrateResult {
  totalTransactionsUpdated: number;
  totalRulesUpdated: number;
  categoriesProcessed: number;
}

export function bulkMigrateCategories(
  mapping: Record<string, string>,
): BulkMigrateResult {
  const db = getDatabase();
  const entries = Object.entries(mapping);

  const txStmt = db.prepare(
    "UPDATE transactions SET category = $new, updated_at = datetime('now') WHERE category = $old",
  );
  const ruleStmt = db.prepare(
    "UPDATE category_rules SET category = $new WHERE category = $old",
  );

  let totalTx = 0;
  let totalRules = 0;

  db.run("BEGIN");
  try {
    for (const [oldName, newName] of entries) {
      const txResult = txStmt.run({ $old: oldName, $new: newName });
      const ruleResult = ruleStmt.run({ $old: oldName, $new: newName });
      totalTx += txResult.changes;
      totalRules += ruleResult.changes;
    }
    db.run("COMMIT");
  } catch (err) {
    db.run("ROLLBACK");
    throw err;
  }

  return {
    totalTransactionsUpdated: totalTx,
    totalRulesUpdated: totalRules,
    categoriesProcessed: entries.length,
  };
}

export interface BulkMigrateDryRunEntry {
  oldName: string;
  newName: string;
  transactionsAffected: number;
  rulesAffected: number;
}

export function bulkMigrateCategoriesDryRun(
  mapping: Record<string, string>,
): BulkMigrateDryRunEntry[] {
  const db = getDatabase();

  const txStmt = db.prepare(
    "SELECT COUNT(*) AS count FROM transactions WHERE category = $old",
  );
  const ruleStmt = db.prepare(
    "SELECT COUNT(*) AS count FROM category_rules WHERE category = $old",
  );

  const results: BulkMigrateDryRunEntry[] = [];

  for (const [oldName, newName] of Object.entries(mapping)) {
    const txRow = txStmt.get({ $old: oldName }) as { count: number };
    const ruleRow = ruleStmt.get({ $old: oldName }) as { count: number };
    results.push({
      oldName,
      newName,
      transactionsAffected: txRow.count,
      rulesAffected: ruleRow.count,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Bulk rule import
// ---------------------------------------------------------------------------

export function bulkImportCategoryRules(
  rules: CategoryRuleInput[],
): { imported: number; skipped: number } {
  const db = getDatabase();
  let imported = 0;
  let skipped = 0;

  const insertStmt = db.prepare(
    `INSERT INTO category_rules (category, conditions, priority)
     SELECT $category, $conditions, $priority
     WHERE NOT EXISTS (
       SELECT 1 FROM category_rules WHERE conditions = $conditions
     )`,
  );

  for (const rule of rules) {
    const conditionsJson = serializeConditions(rule.conditions);
    const result = insertStmt.run({
      $category: rule.category,
      $conditions: conditionsJson,
      $priority: rule.priority ?? 0,
    });
    if (result.changes > 0) {
      imported++;
    } else {
      skipped++;
    }
  }

  return { imported, skipped };
}

// ---------------------------------------------------------------------------
// Enhanced category list with source info
// ---------------------------------------------------------------------------

export interface CategoryWithSource {
  category: string;
  transactionCount: number;
  totalAmount: number;
  ruleCount: number;
  source: "transactions" | "rules" | "both";
}

export function listCategoriesWithSource(): CategoryWithSource[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT
         cat.category,
         COALESCE(tc.transaction_count, 0) AS transaction_count,
         COALESCE(tc.total_amount, 0) AS total_amount,
         COALESCE(rc.rule_count, 0) AS rule_count,
         CASE
           WHEN COALESCE(tc.transaction_count, 0) > 0 AND COALESCE(rc.rule_count, 0) > 0 THEN 'both'
           WHEN COALESCE(rc.rule_count, 0) > 0 THEN 'rules'
           ELSE 'transactions'
         END AS source
       FROM (
         SELECT COALESCE(category, 'Uncategorized') AS category FROM transactions
         UNION
         SELECT category FROM category_rules
       ) cat
       LEFT JOIN (
         SELECT COALESCE(category, 'Uncategorized') AS category,
                COUNT(*) AS transaction_count,
                SUM(ABS(charged_amount)) AS total_amount
         FROM transactions
         GROUP BY category
       ) tc ON cat.category = tc.category
       LEFT JOIN (
         SELECT category, COUNT(*) AS rule_count
         FROM category_rules
         GROUP BY category
       ) rc ON cat.category = rc.category
       ORDER BY COALESCE(tc.total_amount, 0) DESC`,
    )
    .all() as Array<{
    category: string;
    transaction_count: number;
    total_amount: number;
    rule_count: number;
    source: string;
  }>;

  return rows.map((r) => ({
    category: r.category,
    transactionCount: r.transaction_count,
    totalAmount: r.total_amount,
    ruleCount: r.rule_count,
    source: r.source as "transactions" | "rules" | "both",
  }));
}

// ---------------------------------------------------------------------------
// Reassign categories by description pattern
// ---------------------------------------------------------------------------

export interface ReassignEntry {
  matchPattern: string;
  toCategory: string;
}

export function reassignCategory(
  matchPattern: string,
  toCategory: string,
): { updated: number } {
  const db = getDatabase();
  const pattern = `%${escapeLike(matchPattern)}%`;
  const result = db
    .prepare(
      `UPDATE transactions
       SET category = $toCategory, updated_at = datetime('now')
       WHERE (description LIKE $pattern ESCAPE '\\' OR description_en LIKE $pattern ESCAPE '\\')`,
    )
    .run({ $toCategory: toCategory, $pattern: pattern });

  return { updated: result.changes };
}

export function reassignCategoryDryRun(
  matchPattern: string,
  _toCategory: string,
): { affected: number } {
  const db = getDatabase();
  const pattern = `%${escapeLike(matchPattern)}%`;
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count FROM transactions
       WHERE (description LIKE $pattern ESCAPE '\\' OR description_en LIKE $pattern ESCAPE '\\')`,
    )
    .get({ $pattern: pattern }) as { count: number };

  return { affected: row.count };
}

export interface BulkReassignResult {
  totalUpdated: number;
  entriesProcessed: number;
}

export function bulkReassignCategories(
  entries: ReassignEntry[],
): BulkReassignResult {
  const db = getDatabase();
  const stmt = db.prepare(
    `UPDATE transactions
     SET category = $toCategory, updated_at = datetime('now')
     WHERE (description LIKE $pattern ESCAPE '\\' OR description_en LIKE $pattern ESCAPE '\\')`,
  );

  let totalUpdated = 0;

  db.run("BEGIN");
  try {
    for (const entry of entries) {
      const pattern = `%${escapeLike(entry.matchPattern)}%`;
      const result = stmt.run({ $toCategory: entry.toCategory, $pattern: pattern });
      totalUpdated += result.changes;
    }
    db.run("COMMIT");
  } catch (err) {
    db.run("ROLLBACK");
    throw err;
  }

  return { totalUpdated, entriesProcessed: entries.length };
}

export interface BulkReassignDryRunEntry {
  matchPattern: string;
  toCategory: string;
  affected: number;
}

export function bulkReassignCategoriesDryRun(
  entries: ReassignEntry[],
): BulkReassignDryRunEntry[] {
  const db = getDatabase();
  const stmt = db.prepare(
    `SELECT COUNT(*) AS count FROM transactions
     WHERE (description LIKE $pattern ESCAPE '\\' OR description_en LIKE $pattern ESCAPE '\\')`,
  );

  return entries.map((entry) => {
    const pattern = `%${escapeLike(entry.matchPattern)}%`;
    const row = stmt.get({ $pattern: pattern }) as { count: number };
    return {
      matchPattern: entry.matchPattern,
      toCategory: entry.toCategory,
      affected: row.count,
    };
  });
}
