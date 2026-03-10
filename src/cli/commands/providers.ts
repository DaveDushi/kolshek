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
  getProvidersByCompanyId,
  listProviders,
  deleteProvider,
} from "../../db/repositories/providers.js";
import {
  storeCredentials,
  getCredentials,
  deleteCredentials,
  hasCredentials,
} from "../../security/keychain.js";
import { scrapeProvider, findChromePath, launchBrowser, closeBrowser } from "../../core/scraper.js";
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
  formatDateTime,
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
    .action(async () => {
      const all = listProviders();

      // Check credentials for each provider in parallel
      const authStatuses = await Promise.all(
        all.map((p) => hasCredentials(p.alias)),
      );

      if (isJsonMode()) {
        printJson(
          jsonSuccess(
            all.map((p, i) => ({
              id: p.id,
              companyId: p.companyId,
              alias: p.alias,
              displayName: p.displayName,
              type: p.type,
              authenticated: authStatuses[i],
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
        ["ID", "Alias", "Name", "Type", "Company ID", "Auth", "Last Synced"],
        all.map((p, i) => [
          String(p.id),
          p.alias,
          p.displayName,
          p.type,
          p.companyId,
          authStatuses[i] ? "Yes" : "No",
          p.lastSyncedAt ? formatDateTime(p.lastSyncedAt) : "Never",
        ]),
      );
      console.log(table);
    });

  // --- providers add ---
  providers
    .command("add")
    .description("Add a new bank or credit card provider")
    .option("--visible", "Show the browser window (needed for OTP / 2FA)", false)
    .action(async (opts: { visible?: boolean }) => {
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

      const providerInfo = PROVIDERS[companyId];

      // If this companyId already has instances, prompt for an alias
      const existingInstances = getProvidersByCompanyId(companyId);
      let alias: string = companyId;
      if (existingInstances.length > 0) {
        info(`${providerInfo.displayName} already has ${existingInstances.length} instance(s): ${existingInstances.map((p) => p.alias).join(", ")}`);
        alias = await input({
          message: "Alias for this instance (e.g. leumi-joint):",
          validate: (v) => {
            if (!v.trim()) return "Alias is required";
            if (!/^[a-zA-Z0-9_-]+$/.test(v)) return "Use only letters, numbers, dashes, underscores";
            return true;
          },
        });
      }

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
          let browser;
          try {
            if (opts.visible) {
              spinner.info("Launching visible browser — complete OTP/2FA in the browser window.");
              browser = await launchBrowser(chromePath, { headless: false });
            }
            const result = await scrapeProvider({
              companyId,
              credentials,
              startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              chromePath,
              browser,
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
          } finally {
            if (browser) await closeBrowser(browser).catch(() => {});
          }
        }
      }

      // Save credentials (keychain or file fallback)
      const credBackend = await storeCredentials(alias, credentials);
      if (credBackend === "file") {
        info("Credentials saved to file (OS keychain unavailable).");
      }

      const provider = createProvider(
        companyId,
        providerInfo.displayName,
        providerInfo.type,
        alias,
      );

      if (isJsonMode()) {
        printJson(jsonSuccess(provider));
      } else {
        success(`${providerInfo.displayName} added (ID: ${provider.id}).`);
      }
    });

  // --- providers auth ---
  providers
    .command("auth <id>")
    .description("Set or update credentials for an existing provider")
    .option("--visible", "Show the browser window (needed for OTP / 2FA)", false)
    .action(async (idStr: string, opts: { visible?: boolean }) => {
      const id = Number(idStr);
      const provider = getProvider(id);

      if (!provider) {
        printError("NOT_FOUND", `Provider with ID ${id} not found`);
        process.exit(ExitCode.BadArgs);
      }

      if (!isInteractive()) {
        printError("NON_INTERACTIVE", "providers auth requires interactive mode", {
          suggestions: ["Use KOLSHEK_CREDENTIALS_JSON env var instead"],
        });
        process.exit(ExitCode.Error);
      }

      const providerInfo = PROVIDERS[provider.companyId as CompanyId];
      if (!providerInfo) {
        printError("UNKNOWN_PROVIDER", `Unknown company ID: ${provider.companyId}`);
        process.exit(ExitCode.Error);
      }

      const existing = await hasCredentials(provider.alias);
      if (existing) {
        info(`${provider.displayName} already has credentials stored.`);
        const proceed = await confirm({
          message: "Replace existing credentials?",
          default: true,
        });
        if (!proceed) {
          info("Cancelled.");
          return;
        }
      }

      info(`${providerInfo.displayName} requires: ${providerInfo.loginFields.join(", ")}\n`);

      const credentials: Record<string, string> = {};
      for (const field of providerInfo.loginFields) {
        if (field === "password") {
          credentials[field] = await password({
            message: `${field}:`,
            mask: "*",
          });
        } else if (field === "otpLongTermToken") {
          credentials[field] = await password({
            message: `${field} (leave empty if not available):`,
            mask: "*",
          });
        } else {
          credentials[field] = await input({ message: `${field}:` });
        }
      }

      // Optional connection test
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
          let browser;
          try {
            if (opts.visible) {
              spinner.info("Launching visible browser — complete OTP/2FA in the browser window.");
              browser = await launchBrowser(chromePath, { headless: false });
            }
            const result = await scrapeProvider({
              companyId: provider.companyId,
              credentials,
              startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              chromePath,
              browser,
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
          } finally {
            if (browser) await closeBrowser(browser).catch(() => {});
          }
        }
      }

      // Save credentials (keychain or file fallback)
      const credBackend = await storeCredentials(provider.alias, credentials);
      if (credBackend === "keychain") {
        success(`Credentials saved for ${provider.displayName}.`);
      } else {
        success(`Credentials saved to file for ${provider.displayName} (OS keychain unavailable).`);
      }

      if (isJsonMode()) {
        printJson(jsonSuccess({ id: provider.id, alias: provider.alias, authenticated: true }));
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
        await deleteCredentials(provider.alias);
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
    .option("--visible", "Show the browser window (needed for OTP / 2FA)", false)
    .action(async (idStr: string, opts: { visible?: boolean }) => {
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

      const credentials = await getCredentials(provider.alias);
      if (!credentials) {
        printError("NO_CREDENTIALS", "No credentials found for this provider", {
          provider: provider.alias,
          suggestions: [
            `Run: kolshek providers auth ${id}`,
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

      let browser;
      try {
        if (opts.visible) {
          spinner.info("Launching visible browser — complete OTP/2FA in the browser window.");
          browser = await launchBrowser(chromePath, { headless: false });
        }
        const result = await scrapeProvider({
          companyId: provider.companyId,
          credentials,
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          chromePath,
          browser,
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
      } finally {
        if (browser) await closeBrowser(browser).catch(() => {});
      }
    });
}
