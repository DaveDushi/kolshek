/**
 * kolshek init — First-run setup wizard.
 */

import type { Command } from "commander";
import { select, input, password, confirm, checkbox } from "@inquirer/prompts";
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
  getProvidersByCompanyId,
} from "../../db/repositories/providers.js";
import {
  storeCredentials,
} from "../../security/keychain.js";
import { createExcludedAccount } from "../../db/repositories/accounts.js";
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
import { getSplashBanner } from "../splash.js";

function zeroCredentials(creds: Record<string, string>): void {
  for (const key of Object.keys(creds)) {
    creds[key] = "";
  }
}

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("First-run setup wizard — configure your first provider")
    .option("--setup-only", "Initialize database and directories only (no interactive wizard)")
    .action(async (opts: { setupOnly?: boolean }) => {
      // --setup-only: headless DB/dir init for use by AI agents
      if (opts.setupOnly) {
        await ensureDirectories();
        initDatabase(getDbPath());
        if (isJsonMode()) {
          printJson(jsonSuccess({ status: "initialized" }));
        } else {
          success("Database and directories initialized.");
          info("  Add providers: run 'kolshek init' in your terminal.");
        }
        return;
      }

      if (!isInteractive()) {
        if (isJsonMode()) {
          printJson(
            jsonError("NON_INTERACTIVE", "init requires an interactive terminal for credential entry", {
              suggestions: [
                "Run 'kolshek init' in your own terminal (not inside an AI agent)",
                "Use 'kolshek init --setup-only' to initialize the database without the wizard",
                "Use 'kolshek providers add' in your terminal to add providers individually",
              ],
            }),
          );
        } else {
          printError("NON_INTERACTIVE", "init requires an interactive terminal for credential entry", {
            suggestions: [
              "Run 'kolshek init' in your own terminal (not inside an AI agent)",
              "Use 'kolshek init --setup-only' to initialize the database without the wizard",
              "Use 'kolshek providers add' in your terminal to add providers individually",
            ],
          });
        }
        process.exit(ExitCode.Error);
      }

      // Ensure dirs and DB
      await ensureDirectories();
      initDatabase(getDbPath());

      console.log(getSplashBanner());
      info("Let's set up your bank and credit card providers.\n");

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

      const configuredProviders: string[] = [];

      // Loop: add providers until the user is done
      let addMore = true;
      while (addMore) {
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

        // Check if already configured — allow adding another instance with alias
        const existingInstances = getProvidersByCompanyId(companyId);
        let alias: string = companyId;
        let isUpdate = false;
        if (existingInstances.length > 0) {
          warn(`${providerInfo.displayName} already has ${existingInstances.length} instance(s): ${existingInstances.map((p) => p.alias).join(", ")}`);
          const action = await select<string>({
            message: "What would you like to do?",
            choices: [
              { value: "add", name: "Add another instance (e.g. joint account)" },
              { value: "update", name: "Update existing credentials" },
              { value: "cancel", name: "Cancel" },
            ],
          });
          if (action === "cancel") {
            info("Skipped.");
            const another = await confirm({
              message: "Add another provider?",
              default: false,
            });
            if (another) continue;
            break;
          }
          if (action === "update") {
            isUpdate = true;
            if (existingInstances.length === 1) {
              alias = existingInstances[0].alias;
            } else {
              alias = await select<string>({
                message: "Which instance?",
                choices: existingInstances.map((p) => ({
                  value: p.alias,
                  name: `${p.alias} (${p.displayName})`,
                })),
              });
            }
          } else {
            alias = await input({
              message: "Alias for this instance (e.g. leumi-joint):",
              validate: (v) => {
                if (!v.trim()) return "Alias is required";
                if (!/^[a-zA-Z0-9_-]+$/.test(v)) return "Use only letters, numbers, dashes, underscores";
                return true;
              },
            });
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

        let discoveredAccounts: Array<{ accountNumber: string; balance?: number }> = [];

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
              discoveredAccounts = result.accounts.map((a) => ({
                accountNumber: a.accountNumber,
                balance: a.balance,
              }));
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
                  "You can retry later with 'kolshek providers add'",
                ],
              });
              const retryOrSkip = await confirm({
                message: "Save this provider anyway and continue setup?",
                default: true,
              });
              if (!retryOrSkip) {
                info("Skipped. You can add this provider later with 'kolshek providers add'.");
                const another = await confirm({ message: "Add another provider?", default: false });
                if (another) continue;
                break;
              }
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
            const retryOrSkip = await confirm({
              message: "Save this provider anyway and continue setup?",
              default: true,
            });
            if (!retryOrSkip) {
              info("Skipped. You can add this provider later with 'kolshek providers add'.");
              const another = await confirm({ message: "Add another provider?", default: false });
              if (another) continue;
              break;
            }
          }
        }

        // If multiple accounts discovered, let user choose which to exclude
        let excludedAccountNumbers: string[] = [];
        if (discoveredAccounts.length > 1) {
          excludedAccountNumbers = await checkbox({
            message: "Select accounts to EXCLUDE from syncing (space to toggle, enter to confirm):",
            choices: discoveredAccounts.map((a) => ({
              value: a.accountNumber,
              name: `${formatAccountNumber(a.accountNumber)}${a.balance != null ? ` (${a.balance.toLocaleString("en-IL", { minimumFractionDigits: 2 })})` : ""}`,
            })),
          });

          if (excludedAccountNumbers.length > 0) {
            info(`Excluding ${excludedAccountNumbers.length} account(s) from syncing.`);
          }
        }

        // Step 5: Save credentials
        const saveIt = await confirm({
          message: "Save credentials securely?",
          default: true,
        });
        if (saveIt) {
          const backend = await storeCredentials(alias, credentials);
          if (backend === "keychain") {
            success("Credentials saved to OS keychain.");
          } else {
            success("Credentials saved to local encrypted file (OS keychain unavailable).");
          }
        }
        // Zero credentials from memory
        zeroCredentials(credentials);

        // Save provider to DB
        if (!isUpdate) {
          const provider = createProvider(companyId, providerInfo.displayName, providerInfo.type, alias);

          // Pre-create excluded accounts so sync engine skips them
          for (const acctNum of excludedAccountNumbers) {
            createExcludedAccount(provider.id, acctNum);
          }
        }
        configuredProviders.push(companyId);
        success(`${providerInfo.displayName} configured successfully!`);

        // Ask if they want to add another
        info("");
        addMore = await confirm({
          message: "Add another provider?",
          default: true,
        });
      }

      if (configuredProviders.length === 0) {
        info("No providers configured. Run 'kolshek init' again when ready.");
        return;
      }

      // Tip: double-counting when both bank and CC are synced
      const hasBank = configuredProviders.some((id) => PROVIDERS[id as keyof typeof PROVIDERS]?.type === "bank");
      const hasCC = configuredProviders.some((id) => PROVIDERS[id as keyof typeof PROVIDERS]?.type === "credit_card");
      if (hasBank && hasCC) {
        info("");
        info("Tip: Your bank statement may include credit card billing lines.");
        info("     Use 'kolshek categorize rule add' to tag them and avoid double-counting expenses.");
      }

      // Step 6: Offer initial fetch
      info("");
      const fetchNow = await confirm({
        message: "Fetch transactions now? (goes back as far as each provider allows)",
        default: true,
      });

      if (fetchNow) {
        info('Running "kolshek fetch"...\n');
        // Import dynamically to avoid circular deps at startup
        const { runFetch } = await import("./fetch.js");
        await runFetch({ providers: configuredProviders });
      }

      // Step 7: AI tool integration
      info("");
      const aiTool = await select<string>({
        message: "Do you use an AI coding assistant? Install the KolShek plugin:",
        choices: [
          { value: "skip", name: "Skip — I'll do this later" },
          { value: "claude-code", name: "Claude Code" },
          { value: "opencode", name: "OpenCode" },
          { value: "codex", name: "Codex" },
          { value: "openclaw", name: "OpenClaw" },
        ],
      });

      if (aiTool !== "skip") {
        const { installPlugin, registerClaudeCodePlugin } = await import("./plugin.js");
        const result = installPlugin(aiTool);
        if (result.success) {
          success(`Installed ${result.count} files for ${result.description}`);
          info(`  Location: ${result.dir}`);
          if (aiTool === "claude-code") {
            const reg = registerClaudeCodePlugin(result.dir);
            if (reg.ok) {
              success(reg.message);
              info("  Restart Claude Code to activate the plugin.");
            } else {
              warn(reg.message);
            }
          }
        }
      }

      // Cheat sheet
      info("\n--- What's next ---");
      info("  kolshek providers list       — See configured providers");
      info("  kolshek providers add        — Add another bank/CC");
      info("  kolshek fetch                — Fetch new transactions");
      info("  kolshek transactions list    — Browse transactions");
      info("  kolshek transactions search  — Search by description");
      info("  kolshek translate rule add   — Add a translation rule");
      info("  kolshek categorize rule add  — Add a category rule");
      if (aiTool === "skip") {
        info("  kolshek plugin install <tool> — Install AI assistant plugin");
      }
      info("");

      if (isJsonMode()) {
        printJson(jsonSuccess({ providers: configuredProviders, status: "configured" }));
      }
    });
}
