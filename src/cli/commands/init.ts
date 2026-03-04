/**
 * kolshek init — First-run setup wizard.
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
  ensureDirectories,
  getDbPath,
} from "../../config/loader.js";
import { initDatabase } from "../../db/database.js";
import {
  createProvider,
  getProviderByCompanyId,
} from "../../db/repositories/providers.js";
import {
  storeCredentials,
  hasKeychainSupport,
} from "../../security/keychain.js";
import { scrapeProvider, findChromePath } from "../../core/scraper.js";
import {
  isJsonMode,
  isInteractive,
  printJson,
  jsonSuccess,
  jsonError,
  sanitizeError,
  success,
  info,
  warn,
  printError,
  createSpinner,
  formatAccountNumber,
  ExitCode,
} from "../output.js";

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("First-run setup wizard — configure your first provider")
    .action(async () => {
      if (!isInteractive()) {
        if (isJsonMode()) {
          printJson(
            jsonError("NON_INTERACTIVE", "init requires interactive mode", {
              suggestions: [
                "Run without --non-interactive",
                "Use 'kolshek providers add' with env var credentials instead",
              ],
            }),
          );
        } else {
          printError("NON_INTERACTIVE", "init requires interactive mode", {
            suggestions: [
              "Run without --non-interactive",
              "Use 'kolshek providers add' with env var credentials instead",
            ],
          });
        }
        process.exit(ExitCode.Error);
      }

      // Ensure dirs and DB
      await ensureDirectories();
      initDatabase(getDbPath());

      info("");
      info("Welcome to kolshek (כל שקל) — Israeli finance tracker");
      info("Let's set up your first bank or credit card provider.\n");

      // Disclaimer
      info("⚠  This tool stores your bank credentials in your OS keychain.");
      info("   Your data stays 100% local. No cloud, no telemetry.\n");

      // Check Chrome
      const chromePath = findChromePath();
      if (!chromePath) {
        printError("CHROME_NOT_FOUND", "Chrome/Chromium not found", {
          suggestions: [
            "Install Google Chrome from https://google.com/chrome",
            "Or set KOLSHEK_CHROME_PATH environment variable",
          ],
        });
        process.exit(ExitCode.Error);
      }

      // Step 1: Provider type
      const providerType = await select<ProviderType>({
        message: "What would you like to add?",
        choices: [
          { value: "bank" as ProviderType, name: "Bank account" },
          { value: "credit_card" as ProviderType, name: "Credit card" },
        ],
      });

      // Step 2: Provider selection
      const providers = getProvidersByType(providerType);
      const companyId = await select<CompanyId>({
        message: `Select your ${providerType === "bank" ? "bank" : "credit card company"}:`,
        choices: providers.map((p) => ({
          value: p.companyId,
          name: p.displayName,
        })),
      });

      const providerInfo = PROVIDERS[companyId];

      // Check if already configured
      const existing = getProviderByCompanyId(companyId);
      if (existing) {
        warn(`${providerInfo.displayName} is already configured.`);
        const proceed = await confirm({
          message: "Would you like to update its credentials?",
          default: false,
        });
        if (!proceed) {
          info("Setup cancelled.");
          return;
        }
      }

      // Step 3: Enter credentials
      info(`\n${providerInfo.displayName} requires: ${providerInfo.loginFields.join(", ")}\n`);

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
          credentials[field] = await input({
            message: `${field}:`,
          });
        }
      }

      // Step 4: Test connection
      const testIt = await confirm({
        message: "Test the connection now?",
        default: true,
      });

      if (testIt) {
        if (process.env.DEBUG) {
          warn("DEBUG env var is set — upstream scrapers may log sensitive data (credentials, account numbers) to stderr.");
        }

        const spinner = createSpinner(
          `Testing connection to ${providerInfo.displayName}...`,
        );
        spinner.start();

        try {
          const result = await scrapeProvider({
            companyId,
            credentials,
            startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week
            chromePath,
          });

          if (result.success) {
            spinner.succeed(
              `Connected! Found ${result.accounts.length} account(s).`,
            );
            for (const acc of result.accounts) {
              const bal =
                acc.balance != null
                  ? ` — Balance: ₪${acc.balance.toLocaleString("en-IL", { minimumFractionDigits: 2 })}`
                  : "";
              info(`  Account: ${formatAccountNumber(acc.accountNumber)}${bal}`);
            }
          } else {
            const safeError = sanitizeError(result.error ?? "Unknown error", credentials);
            spinner.fail(`Connection failed: ${safeError}`);
            printError("AUTH_FAILURE", safeError, {
              provider: companyId,
              retryable: true,
              suggestions: [
                "Double-check your credentials",
                "Make sure your account is not locked",
                "Some banks require OTP on first login",
              ],
            });
            process.exit(ExitCode.AuthFailure);
          }
        } catch (err) {
          spinner.fail("Connection test failed");
          printError(
            "SCRAPE_ERROR",
            sanitizeError(err instanceof Error ? err.message : String(err), credentials),
            {
              provider: companyId,
              retryable: true,
            },
          );
          process.exit(ExitCode.Error);
        }
      }

      // Step 5: Save credentials
      const keychainAvailable = await hasKeychainSupport();
      if (keychainAvailable) {
        const saveIt = await confirm({
          message: "Save credentials to OS keychain?",
          default: true,
        });
        if (saveIt) {
          await storeCredentials(companyId, credentials);
          success("Credentials saved to OS keychain.");
        }
      } else {
        warn(
          "OS keychain not available. Set KOLSHEK_CREDENTIALS_JSON env var for automation.",
        );
      }

      // Save provider to DB
      if (!existing) {
        createProvider(companyId, providerInfo.displayName, providerInfo.type);
      }
      success(`${providerInfo.displayName} configured successfully!`);

      // Step 6: Offer initial fetch
      info("");
      const fetchNow = await confirm({
        message: "Fetch transactions now? (last 3 months)",
        default: true,
      });

      if (fetchNow) {
        info('Running "kolshek fetch"...\n');
        // Import dynamically to avoid circular deps at startup
        const { runFetch } = await import("./fetch.js");
        await runFetch({ providers: [companyId] });
      }

      // Cheat sheet
      info("\n--- What's next ---");
      info("  kolshek providers list       — See configured providers");
      info("  kolshek providers add        — Add another bank/CC");
      info("  kolshek fetch                — Fetch new transactions");
      info("  kolshek transactions list    — Browse transactions");
      info("  kolshek transactions search  — Search by description");
      info("");

      if (isJsonMode()) {
        printJson(jsonSuccess({ provider: companyId, status: "configured" }));
      }
    });
}
