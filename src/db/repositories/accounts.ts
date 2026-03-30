import type { Account } from "../../types/index.js";
import { getDatabase } from "../database.js";

interface AccountRow {
  id: number;
  provider_id: number;
  account_number: string;
  display_name: string | null;
  balance: number | null;
  currency: string;
  excluded: number;
  created_at: string;
}

function rowToAccount(row: AccountRow): Account {
  return {
    id: row.id,
    providerId: row.provider_id,
    accountNumber: row.account_number,
    displayName: row.display_name,
    balance: row.balance,
    currency: row.currency,
    excluded: row.excluded === 1,
    createdAt: row.created_at,
  };
}

export function upsertAccount(
  providerId: number,
  accountNumber: string,
  companyId: string,
  balance?: number,
  currency?: string,
): Account {
  const db = getDatabase();

  // Check if another provider with the same company_id already owns this account.
  // This prevents duplicates when multiple provider configs (e.g. two Max logins)
  // discover the same credit card.
  const existing = db
    .prepare(
      `SELECT a.* FROM accounts a
       JOIN providers p ON a.provider_id = p.id
       WHERE p.company_id = $companyId
         AND a.account_number = $accountNumber
       LIMIT 1`,
    )
    .get({
      $companyId: companyId,
      $accountNumber: accountNumber,
    }) as AccountRow | null;

  if (existing) {
    // Reuse the existing account — just refresh balance/currency
    db.prepare(
      `UPDATE accounts SET
         balance = COALESCE($balance, balance),
         currency = COALESCE($currency, currency)
       WHERE id = $id`,
    ).run({
      $balance: balance ?? null,
      $currency: currency ?? null,
      $id: existing.id,
    });
    if (balance !== undefined) existing.balance = balance;
    if (currency !== undefined) existing.currency = currency;
    return rowToAccount(existing);
  }

  // No existing account for this company_id — insert under this provider
  const row = db
    .prepare(
      `INSERT INTO accounts (provider_id, account_number, balance, currency)
       VALUES ($providerId, $accountNumber, $balance, $currency)
       ON CONFLICT (provider_id, account_number) DO UPDATE SET
         balance = COALESCE(excluded.balance, accounts.balance),
         currency = COALESCE(excluded.currency, accounts.currency)
       RETURNING *`,
    )
    .get({
      $providerId: providerId,
      $accountNumber: accountNumber,
      $balance: balance ?? null,
      $currency: currency ?? "ILS",
    }) as AccountRow;

  return rowToAccount(row);
}

export function getAccountsByProvider(providerId: number): Account[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      "SELECT * FROM accounts WHERE provider_id = $providerId ORDER BY account_number",
    )
    .all({ $providerId: providerId }) as AccountRow[];

  return rows.map(rowToAccount);
}

export function getAccount(id: number): Account | null {
  const db = getDatabase();
  const row = db
    .prepare("SELECT * FROM accounts WHERE id = $id")
    .get({ $id: id }) as AccountRow | null;

  return row ? rowToAccount(row) : null;
}

export function updateAccountExcluded(id: number, excluded: boolean): void {
  const db = getDatabase();
  db.prepare("UPDATE accounts SET excluded = $excluded WHERE id = $id").run({
    $excluded: excluded ? 1 : 0,
    $id: id,
  });
}

// Check if an account is excluded by company_id + account_number.
// Used by sync engine before processing scraped accounts.
export function isAccountExcludedByKey(
  companyId: string,
  accountNumber: string,
): boolean {
  const db = getDatabase();
  const row = db
    .prepare(
      `SELECT a.excluded FROM accounts a
       JOIN providers p ON a.provider_id = p.id
       WHERE p.company_id = $companyId
         AND a.account_number = $accountNumber
       LIMIT 1`,
    )
    .get({
      $companyId: companyId,
      $accountNumber: accountNumber,
    }) as { excluded: number } | null;

  return row?.excluded === 1;
}

// Pre-create an account marked as excluded (used during provider setup).
export function createExcludedAccount(
  providerId: number,
  accountNumber: string,
): void {
  const db = getDatabase();
  db.prepare(
    `INSERT INTO accounts (provider_id, account_number, excluded)
     VALUES ($providerId, $accountNumber, 1)
     ON CONFLICT (provider_id, account_number) DO UPDATE SET excluded = 1`,
  ).run({
    $providerId: providerId,
    $accountNumber: accountNumber,
  });
}
