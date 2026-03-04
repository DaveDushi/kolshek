/**
 * kolshek providers — Provider management commands.
 */

import type { Command } from "commander";
import { select, input, password, confirm } from "@inquirer/prompts";
import {
  PROVIDERS,
  getProvidersByType,
  type ProviderType,
  type CompanyId,
} from "../../types/index.js";
import {
  createProvider,
  getProvider,
  getProviderByCompanyId,
  listProviders,
  deleteProvider,
} from "../../db/repositories/providers.js";
import {
  storeCredentials,
  getCredentials,
  deleteCredentials,
  hasKeychainSupport,
} from "../../security/keychain.js";
import { scrapeProvider, findChromePath } from "../../core/scraper.js";
import {
  isJsonMode,
  isInteractive,
  printJson,
  jsonSuccess,
  sanitizeError,
  printError,
  success,
  info,
  warn,
  createTable,
  createSpinner,
  formatDate,
  formatAccountNumber,
  ExitCode,
} from "../output.js";

export function registerProvidersCommand(program: Command): void {
  const providers = program
    .command("providers")
    .description("Manage bank and credit card providers");

  // --- providers list ---
  providers
    .command("list")
    .description("List configured providers")
    .action(() => {
      const all = listProviders();

      if (isJsonMode()) {
        printJson(
          jsonSuccess(
            all.map((p) => ({
              id: p.id,
              companyId: p.companyId,
              displayName: p.displayName,
              type: p.type,
              lastSyncedAt: p.lastSyncedAt,
              createdAt: p.createdAt,
            })),
          ),
        );
        return;
      }

      if (all.length === 0) {
        info('No providers configured. Run "kolshek providers add" to get started.');
        return;
      }

      const table = createTable(
        ["ID", "Name", "Type", "Company ID", "Last Synced"],
        all.map((p) => [
          String(p.id),
          p.displayName,
          p.type,
          p.companyId,
          p.lastSyncedAt ? formatDate(p.lastSyncedAt) : "Never",
        ]),
      );
      console.log(table);
    });

  // --- providers add ---
  providers
    .command("add")
    .description("Add a new bank or credit card provider")
    .action(async () => {
      if (!isInteractive()) {
        printError("NON_INTERACTIVE", "providers add requires interactive mode");
        process.exit(ExitCode.Error);
      }

      // Select type
      const providerType = await select<ProviderType>({
        message: "Provider type:",
        choices: [
          { value: "bank" as ProviderType, name: "Bank" },
          { value: "credit_card" as ProviderType, name: "Credit card" },
        ],
      });

      // Select provider
      const available = getProvidersByType(providerType);
      const companyId = await select<CompanyId>({
        message: "Select provider:",
        choices: available.map((p) => ({
          value: p.companyId,
          name: p.displayName,
        })),
      });

      // Check duplicate
      const existing = getProviderByCompanyId(companyId);
      if (existing) {
        warn(`${PROVIDERS[companyId].displayName} is already configured (ID: ${existing.id}).`);
        process.exit(ExitCode.Error);
      }

      const providerInfo = PROVIDERS[companyId];

      // Enter credentials
      const credentials: Record<string, string> = {};
      for (const field of providerInfo.loginFields) {
        if (field === "password") {
          credentials[field] = await password({
            message: `${field}:`,
            mask: "*",
          });
        } else {
          credentials[field] = await input({ message: `${field}:` });
        }
      }

      // Test connection
      const chromePath = findChromePath();
      if (chromePath) {
        const doTest = await confirm({
          message: "Test connection?",
          default: true,
        });

        if (doTest) {
          if (process.env.DEBUG) {
            warn("DEBUG env var is set — upstream scrapers may log sensitive data (credentials, account numbers) to stderr.");
          }

          const spinner = createSpinner("Testing connection...");
          spinner.start();
          try {
            const result = await scrapeProvider({
              companyId,
              credentials,
              startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              chromePath,
            });
            if (result.success) {
              spinner.succeed(
                `Connected! Found ${result.accounts.length} account(s).`,
              );
            } else {
              spinner.fail(`Test failed: ${sanitizeError(result.error ?? "", credentials)}`);
              const proceed = await confirm({
                message: "Save anyway?",
                default: false,
              });
              if (!proceed) {
                process.exit(ExitCode.AuthFailure);
              }
            }
          } catch (err) {
            spinner.fail(
              `Test error: ${sanitizeError(err instanceof Error ? err.message : String(err), credentials)}`,
            );
          }
        }
      }

      // Save
      const keychainAvailable = await hasKeychainSupport();
      if (keychainAvailable) {
        await storeCredentials(companyId, credentials);
      } else {
        warn("Keychain unavailable — credentials NOT saved. Use env vars.");
      }

      const provider = createProvider(
        companyId,
        providerInfo.displayName,
        providerInfo.type,
      );

      if (isJsonMode()) {
        printJson(jsonSuccess(provider));
      } else {
        success(`${providerInfo.displayName} added (ID: ${provider.id}).`);
      }
    });

  // --- providers remove ---
  providers
    .command("remove <id>")
    .description("Remove a configured provider")
    .action(async (idStr: string) => {
      const id = Number(idStr);
      const provider = getProvider(id);

      if (!provider) {
        printError("NOT_FOUND", `Provider with ID ${id} not found`);
        process.exit(ExitCode.BadArgs);
      }

      if (isInteractive()) {
        const ok = await confirm({
          message: `Remove ${provider.displayName} and its credentials?`,
          default: false,
        });
        if (!ok) {
          info("Cancelled.");
          return;
        }
      }

      // Delete credentials and provider
      try {
        await deleteCredentials(provider.companyId);
      } catch {
        // Credentials may not exist in keychain
      }
      deleteProvider(id);

      if (isJsonMode()) {
        printJson(jsonSuccess({ removed: id }));
      } else {
        success(`Removed ${provider.displayName}.`);
      }
    });

  // --- providers test ---
  providers
    .command("test <id>")
    .description("Test provider credentials")
    .action(async (idStr: string) => {
      const id = Number(idStr);
      const provider = getProvider(id);

      if (!provider) {
        printError("NOT_FOUND", `Provider with ID ${id} not found`);
        process.exit(ExitCode.BadArgs);
      }

      const chromePath = findChromePath();
      if (!chromePath) {
        printError("CHROME_NOT_FOUND", "Chrome/Chromium not found", {
          suggestions: [
            "Install Chrome or set KOLSHEK_CHROME_PATH",
          ],
        });
        process.exit(ExitCode.Error);
      }

      const credentials = await getCredentials(provider.companyId);
      if (!credentials) {
        printError("NO_CREDENTIALS", "No credentials found for this provider", {
          provider: provider.companyId,
          suggestions: [
            `Run: kolshek providers remove ${id} && kolshek providers add`,
            "Or set KOLSHEK_CREDENTIALS_JSON environment variable",
          ],
        });
        process.exit(ExitCode.AuthFailure);
      }

      if (process.env.DEBUG) {
        warn("DEBUG env var is set — upstream scrapers may log sensitive data (credentials, account numbers) to stderr.");
      }

      const spinner = createSpinner(
        `Testing ${provider.displayName}...`,
      );
      spinner.start();

      try {
        const result = await scrapeProvider({
          companyId: provider.companyId,
          credentials,
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          chromePath,
        });

        if (result.success) {
          spinner.succeed(`${provider.displayName} — credentials valid.`);
          for (const acc of result.accounts) {
            const bal =
              acc.balance != null
                ? ` (₪${acc.balance.toLocaleString("en-IL", { minimumFractionDigits: 2 })})`
                : "";
            info(`  Account: ${formatAccountNumber(acc.accountNumber)}${bal}`);
          }

          if (isJsonMode()) {
            printJson(
              jsonSuccess({
                provider: provider.companyId,
                valid: true,
                accounts: result.accounts.map((a) => ({
                  accountNumber: formatAccountNumber(a.accountNumber),
                  balance: a.balance,
                })),
              }),
            );
          }
        } else {
          spinner.fail(`${provider.displayName} — test failed.`);
          printError("AUTH_FAILURE", sanitizeError(result.error ?? "Unknown error", credentials), {
            provider: provider.companyId,
            retryable: true,
          });
          process.exit(ExitCode.AuthFailure);
        }
      } catch (err) {
        spinner.fail("Test failed");
        printError("SCRAPE_ERROR", sanitizeError(err instanceof Error ? err.message : String(err), credentials), {
          provider: provider.companyId,
          retryable: true,
        });
        process.exit(ExitCode.Error);
      }
    });
}
