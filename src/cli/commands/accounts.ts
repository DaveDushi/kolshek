/**
 * kolshek accounts — View accounts and balances.
 */

import type { Command } from "commander";
import {
  isJsonMode,
  printJson,
  jsonSuccess,
  info,
  createTable,
  formatCurrency,
  formatAccountNumber,
  formatDate,
} from "../output.js";
import { getDatabase } from "../../db/database.js";

interface AccountWithProviderRow {
  id: number;
  account_number: string;
  display_name: string | null;
  balance: number | null;
  currency: string;
  created_at: string;
  provider_display_name: string;
  provider_company_id: string;
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
        a.created_at,
        p.display_name AS provider_display_name,
        p.company_id AS provider_company_id,
        p.type AS provider_type,
        p.last_synced_at
      FROM accounts a
      JOIN providers p ON a.provider_id = p.id
      ORDER BY p.display_name, a.account_number`,
    )
    .all() as AccountWithProviderRow[];
}

export function registerAccountsCommand(program: Command): void {
  program
    .command("accounts")
    .alias("bal")
    .description("Show accounts and balances")
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
              provider: a.provider_company_id,
              providerName: a.provider_display_name,
              providerType: a.provider_type,
              lastSyncedAt: a.last_synced_at,
            })),
            totalBalance: accounts.reduce(
              (sum, a) => sum + (a.balance ?? 0),
              0,
            ),
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
        ["Provider", "Account", "Balance", "Currency", "Last Synced"],
        accounts.map((a) => [
          a.provider_display_name,
          formatAccountNumber(a.account_number, true),
          a.balance != null
            ? formatCurrency(a.balance, a.currency)
            : "N/A",
          a.currency,
          a.last_synced_at ? formatDate(a.last_synced_at) : "Never",
        ]),
      );
      console.log(table);

      // Show total for ILS accounts
      const ilsAccounts = accounts.filter(
        (a) => a.currency === "ILS" && a.balance != null,
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
}
