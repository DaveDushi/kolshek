/**
 * Translation rule CRUD and application logic.
 */

import { getDatabase } from "../database.js";
import { escapeLike } from "../utils.js";

export interface TranslationRule {
  id: number;
  englishName: string;
  matchPattern: string;
  createdAt: string;
}

interface TranslationRuleRow {
  id: number;
  english_name: string;
  match_pattern: string;
  created_at: string;
}

function rowToRule(row: TranslationRuleRow): TranslationRule {
  return {
    id: row.id,
    englishName: row.english_name,
    matchPattern: row.match_pattern,
    createdAt: row.created_at,
  };
}

export function addTranslationRule(englishName: string, pattern: string): TranslationRule {
  const db = getDatabase();
  const result = db
    .prepare(
      "INSERT INTO translation_rules (english_name, match_pattern) VALUES ($englishName, $pattern)",
    )
    .run({ $englishName: englishName, $pattern: pattern });

  const row = db
    .prepare("SELECT * FROM translation_rules WHERE id = $id")
    .get({ $id: result.lastInsertRowid }) as TranslationRuleRow;

  return rowToRule(row);
}

export function listTranslationRules(): TranslationRule[] {
  const db = getDatabase();
  const rows = db
    .prepare("SELECT * FROM translation_rules ORDER BY id")
    .all() as TranslationRuleRow[];

  return rows.map(rowToRule);
}

export function removeTranslationRule(id: number): boolean {
  const db = getDatabase();
  const result = db
    .prepare("DELETE FROM translation_rules WHERE id = $id")
    .run({ $id: id });

  return result.changes > 0;
}

export function applyTranslationRules(): { applied: number } {
  const db = getDatabase();
  const rules = db
    .prepare("SELECT * FROM translation_rules ORDER BY id")
    .all() as TranslationRuleRow[];

  let applied = 0;

  db.run("BEGIN");
  try {
    for (const rule of rules) {
      const pattern = `%${escapeLike(rule.match_pattern)}%`;
      const result = db
        .prepare(
          `UPDATE transactions
           SET description_en = $englishName, updated_at = datetime('now')
           WHERE description LIKE $pattern ESCAPE '\\'
             AND description_en IS NULL`,
        )
        .run({ $englishName: rule.english_name, $pattern: pattern });

      applied += result.changes;
    }
    db.run("COMMIT");
  } catch (err) {
    db.run("ROLLBACK");
    throw err;
  }

  return { applied };
}

export interface UntranslatedGroup {
  description: string;
  count: number;
  totalAmount: number;
}

export function listUntranslatedGrouped(): UntranslatedGroup[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT description, COUNT(*) AS count, SUM(ABS(charged_amount)) AS total_amount
       FROM transactions
       WHERE description_en IS NULL
       GROUP BY description
       ORDER BY count DESC, total_amount DESC`,
    )
    .all() as Array<{ description: string; count: number; total_amount: number }>;

  return rows.map((r) => ({
    description: r.description,
    count: r.count,
    totalAmount: r.total_amount,
  }));
}

// Translate all transactions matching a Hebrew description
export function translateByDescription(
  hebrewDesc: string,
  englishName: string,
): number {
  const db = getDatabase();
  const result = db
    .prepare(
      `UPDATE transactions SET description_en = $en, updated_at = datetime('now')
       WHERE description = $desc AND description_en IS NULL`,
    )
    .run({ $en: englishName, $desc: hebrewDesc });
  return result.changes;
}

export interface TranslatedGroup {
  description: string;
  descriptionEn: string;
  count: number;
  totalAmount: number;
}

export function listTranslatedGrouped(): TranslatedGroup[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT description, description_en, COUNT(*) AS count, SUM(ABS(charged_amount)) AS total_amount
       FROM transactions
       WHERE description_en IS NOT NULL
       GROUP BY description, description_en
       ORDER BY count DESC, total_amount DESC`,
    )
    .all() as Array<{ description: string; description_en: string; count: number; total_amount: number }>;

  return rows.map((r) => ({
    description: r.description,
    descriptionEn: r.description_en,
    count: r.count,
    totalAmount: r.total_amount,
  }));
}

// Update translation for all transactions matching a Hebrew description (overwrites existing)
export function updateTranslationByDescription(
  hebrewDesc: string,
  englishName: string,
): number {
  const db = getDatabase();
  const result = db
    .prepare(
      `UPDATE transactions SET description_en = $en, updated_at = datetime('now')
       WHERE description = $desc`,
    )
    .run({ $en: englishName, $desc: hebrewDesc });
  return result.changes;
}

export interface TranslationRuleInput {
  englishName: string;
  matchPattern: string;
}

export function bulkImportTranslationRules(
  rules: TranslationRuleInput[],
): { imported: number; skipped: number } {
  const db = getDatabase();
  let imported = 0;
  let skipped = 0;

  const insertStmt = db.prepare(
    `INSERT INTO translation_rules (english_name, match_pattern)
     SELECT $englishName, $pattern
     WHERE NOT EXISTS (
       SELECT 1 FROM translation_rules WHERE match_pattern = $pattern
     )`,
  );

  for (const rule of rules) {
    const result = insertStmt.run({
      $englishName: rule.englishName,
      $pattern: rule.matchPattern,
    });
    if (result.changes > 0) {
      imported++;
    } else {
      skipped++;
    }
  }

  return { imported, skipped };
}


