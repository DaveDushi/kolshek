import type { Provider, ProviderType, CompanyId } from "../../types/index.js";
import { getDatabase } from "../database.js";

interface ProviderRow {
  id: number;
  company_id: string;
  alias: string;
  display_name: string;
  type: string;
  last_synced_at: string | null;
  created_at: string;
}

function rowToProvider(row: ProviderRow): Provider {
  return {
    id: row.id,
    companyId: row.company_id as CompanyId,
    alias: row.alias,
    displayName: row.display_name,
    type: row.type as ProviderType,
    lastSyncedAt: row.last_synced_at,
    createdAt: row.created_at,
  };
}

export function createProvider(
  companyId: string,
  displayName: string,
  type: ProviderType,
  alias?: string,
): Provider {
  const db = getDatabase();
  const row = db
    .prepare(
      `INSERT INTO providers (company_id, alias, display_name, type)
       VALUES ($companyId, $alias, $displayName, $type)
       RETURNING *`,
    )
    .get({
      $companyId: companyId,
      $alias: alias ?? companyId,
      $displayName: displayName,
      $type: type,
    }) as ProviderRow;

  return rowToProvider(row);
}

export function getProvider(id: number): Provider | null {
  const db = getDatabase();
  const row = db
    .prepare("SELECT * FROM providers WHERE id = $id")
    .get({ $id: id }) as ProviderRow | null;

  return row ? rowToProvider(row) : null;
}

export function getProviderByCompanyId(companyId: string): Provider | null {
  const db = getDatabase();
  const row = db
    .prepare("SELECT * FROM providers WHERE company_id = $companyId")
    .get({ $companyId: companyId }) as ProviderRow | null;

  return row ? rowToProvider(row) : null;
}

export function getProvidersByCompanyId(companyId: string): Provider[] {
  const db = getDatabase();
  const rows = db
    .prepare("SELECT * FROM providers WHERE company_id = $companyId ORDER BY alias")
    .all({ $companyId: companyId }) as ProviderRow[];

  return rows.map(rowToProvider);
}

export function getProviderByAlias(alias: string): Provider | null {
  const db = getDatabase();
  const row = db
    .prepare("SELECT * FROM providers WHERE alias = $alias")
    .get({ $alias: alias }) as ProviderRow | null;

  return row ? rowToProvider(row) : null;
}

/**
 * Resolve a user-supplied identifier to providers.
 * Tries: numeric ID → alias (exact) → companyId (all instances).
 */
export function resolveProviders(identifier: string): Provider[] {
  // Try numeric ID
  const numId = Number(identifier);
  if (!isNaN(numId) && String(numId) === identifier) {
    const p = getProvider(numId);
    return p ? [p] : [];
  }

  // Try alias (exact match)
  const byAlias = getProviderByAlias(identifier);
  if (byAlias) return [byAlias];

  // Try companyId (returns all instances)
  return getProvidersByCompanyId(identifier);
}

export function listProviders(): Provider[] {
  const db = getDatabase();
  const rows = db
    .prepare("SELECT * FROM providers ORDER BY display_name, alias")
    .all() as ProviderRow[];

  return rows.map(rowToProvider);
}

export function updateLastSynced(id: number, timestamp: string): void {
  const db = getDatabase();
  db.prepare(
    "UPDATE providers SET last_synced_at = $timestamp WHERE id = $id",
  ).run({ $id: id, $timestamp: timestamp });
}

export function deleteProvider(id: number): void {
  const db = getDatabase();
  db.prepare("DELETE FROM providers WHERE id = $id").run({ $id: id });
}
