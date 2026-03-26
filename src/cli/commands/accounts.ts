// kolshek accounts — View accounts and balances.
// kolshek accounts exclude <id> — Exclude an account from syncing.
// kolshek accounts include <id> — Re-include a previously excluded account.

import type { Command } from "commander";
import {
  isJsonMode,
  printJson,
  jsonSuccess,
  info,
  success,
  createTable,
  formatCurrency,
  formatAccountNumber,
  formatDate,
} from "../output.js";
import { getDatabase } from "../../db/database.js";
import {
  getAccount,
  setAccountExcluded,
} from "../../db/repositories/accounts.js";

interface AccountWithProviderRow {
  id: number;
  account_number: string;
  display_name: string | null;
  balance: number | null;
  currency: string;
  excluded: number;
  created_at: string;
  provider_display_name: string;
  provider_company_id: string;
  provider_alias: string;
  provider_type: string;
  last_synced_at: string | null;
}

function listAccountsWithProviders(): AccountWithProviderRow[] {
  const db = getDatabase();
  return db
    .prepare(
      `SELECT
        a.id,
        a.account_number,
        a.display_name,
        a.balance,
        a.currency,
        a.excluded,
        a.created_at,
        p.display_name AS provider_display_name,
        p.company_id AS provider_company_id,
        p.alias AS provider_alias,
        p.type AS provider_type,
        p.last_synced_at
      FROM accounts a
      JOIN providers p ON a.provider_id = p.id
      ORDER BY p.display_name, a.account_number`,
    )
    .all() as AccountWithProviderRow[];
}

export function registerAccountsCommand(program: Command): void {
  const cmd = program
    .command("accounts")
    .alias("bal")
    .description("Show accounts and balances");

  // Default action: list accounts
  cmd
    .option("--provider <name>", "Filter by provider company ID")
    .option("--type <type>", "Filter by provider type (bank|credit_card)")
    .action((opts) => {
      let accounts = listAccountsWithProviders();

      if (opts.provider) {
        accounts = accounts.filter(
          (a) => a.provider_company_id === opts.provider,
        );
      }
      if (opts.type) {
        accounts = accounts.filter((a) => a.provider_type === opts.type);
      }

      if (isJsonMode()) {
        printJson(
          jsonSuccess({
            accounts: accounts.map((a) => ({
              id: a.id,
              accountNumber: a.account_number,
              displayName: a.display_name,
              balance: a.balance,
              currency: a.currency,
              excluded: a.excluded === 1,
              provider: a.provider_company_id,
              providerAlias: a.provider_alias,
              providerName: a.provider_display_name,
              providerType: a.provider_type,
              lastSyncedAt: a.last_synced_at,
            })),
            totalBalance: accounts
              .filter((a) => a.excluded === 0)
              .reduce((sum, a) => sum + (a.balance ?? 0), 0),
          }),
        );
        return;
      }

      if (accounts.length === 0) {
        info(
          'No accounts found. Run "kolshek fetch" to sync your providers first.',
        );
        return;
      }

      const table = createTable(
        ["ID", "Provider", "Account", "Balance", "Currency", "Status", "Last Synced"],
        accounts.map((a) => [
          String(a.id),
          a.provider_alias,
          formatAccountNumber(a.account_number, true),
          a.balance != null
            ? formatCurrency(a.balance, a.currency)
            : "N/A",
          a.currency,
          a.excluded ? "Excluded" : "Active",
          a.last_synced_at ? formatDate(a.last_synced_at) : "Never",
        ]),
      );
      console.log(table);

      // Show total for ILS accounts (only active)
      const ilsAccounts = accounts.filter(
        (a) => a.currency === "ILS" && a.balance != null && a.excluded === 0,
      );
      if (ilsAccounts.length > 1) {
        const total = ilsAccounts.reduce(
          (sum, a) => sum + (a.balance ?? 0),
          0,
        );
        info(`\nTotal (ILS): ${formatCurrency(total, "ILS")}`);
      }

      info(`\n${accounts.length} account(s).`);
    });

  // accounts exclude <id>
  cmd
    .command("exclude <id>")
    .description("Exclude an account from syncing")
    .action((idStr: string) => {
      const id = parseInt(idStr, 10);
      if (isNaN(id)) {
        console.error("Invalid account ID.");
        process.exit(2);
      }
      const account = getAccount(id);
      if (!account) {
        console.error(`Account ${id} not found.`);
        process.exit(1);
      }
      if (account.excluded) {
        info(`Account ${id} is already excluded.`);
        return;
      }
      setAccountExcluded(id, true);
      if (isJsonMode()) {
        printJson(jsonSuccess({ id, excluded: true }));
      } else {
        success(`Account ${id} (${account.accountNumber}) excluded from syncing.`);
      }
    });

  // accounts include <id>
  cmd
    .command("include <id>")
    .description("Re-include a previously excluded account")
    .action((idStr: string) => {
      const id = parseInt(idStr, 10);
      if (isNaN(id)) {
        console.error("Invalid account ID.");
        process.exit(2);
      }
      const account = getAccount(id);
      if (!account) {
        console.error(`Account ${id} not found.`);
        process.exit(1);
      }
      if (!account.excluded) {
        info(`Account ${id} is already active.`);
        return;
      }
      setAccountExcluded(id, false);
      if (isJsonMode()) {
        printJson(jsonSuccess({ id, excluded: false }));
      } else {
        success(`Account ${id} (${account.accountNumber}) re-included for syncing.`);
      }
    });
}
