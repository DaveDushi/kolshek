import type { Account } from "../../types/index.js";
import { getDatabase } from "../database.js";

interface AccountRow {
  id: number;
  provider_id: number;
  account_number: string;
  display_name: string | null;
  balance: number | null;
  currency: string;
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
    createdAt: row.created_at,
  };
}

export function upsertAccount(
  providerId: number,
  accountNumber: string,
  balance?: number,
  currency?: string,
): Account {
  const db = getDatabase();
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
