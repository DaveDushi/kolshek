// kolshek import — Import transactions from CSV files.

import type { Command } from "commander";
import { resolve } from "path";
import { existsSync } from "fs";
import {
  validateCsvImport,
  buildTransactionInput,
  type CsvTransaction,
} from "../../core/csv-import.js";
import {
  resolveProviders,
  getProviderByAlias,
  getProviderByCompanyId,
} from "../../db/repositories/providers.js";
import { upsertAccount } from "../../db/repositories/accounts.js";
import { upsertTransaction } from "../../db/repositories/transactions.js";
import { getDatabase } from "../../db/database.js";
import type { Provider } from "../../types/index.js";
import {
  isJsonMode,
  printJson,
  jsonSuccess,
  jsonError,
  printError,
  info,
  createTable,
  ExitCode,
  isInteractive,
} from "../output.js";

export function registerImportCommand(program: Command): void {
  const importCmd = program
    .command("import")
    .description("Import transactions from external sources");

  importCmd
    .command("csv <file>")
    .description("Import transactions from a CSV file")
    .option("--dry-run", "Preview what would be imported without writing to DB")
    .option("--skip-errors", "Continue importing valid rows even if some rows fail")
    .action(async (file: string, opts) => {
      const filePath = resolve(file);

      if (!existsSync(filePath)) {
        printError("BAD_ARGS", `File not found: ${filePath}`);
        process.exit(ExitCode.BadArgs);
      }

      // Read and validate CSV
      const text = await Bun.file(filePath).text();
      const validation = validateCsvImport(text);

      if (validation.errors.length > 0 && !opts.skipErrors) {
        if (isJsonMode()) {
          printJson(jsonError("VALIDATION_ERROR", "CSV validation failed"));
          process.exit(ExitCode.BadArgs);
        }

        printError("VALIDATION_ERROR", `CSV has ${validation.errors.length} error(s)`);
        const errRows = validation.errors.slice(0, 20).map((err) => [
          String(err.row), err.column ?? "", err.message,
        ]);
        console.log(createTable(["Row", "Column", "Error"], errRows));
        if (validation.errors.length > 20) {
          info(`... and ${validation.errors.length - 20} more errors`);
        }
        process.exit(ExitCode.BadArgs);
      }

      if (validation.transactions.length === 0) {
        if (isJsonMode()) {
          printJson(jsonSuccess({ imported: 0, duplicates: 0, updated: 0 }));
        } else {
          info("No valid transactions found in the CSV file.");
        }
        return;
      }

      // Group transactions by (provider, account_number)
      const groups = groupByProviderAccount(validation.transactions);

      // Resolve providers and accounts
      const resolvedGroups: Array<{
        provider: Provider;
        accountNumber: string;
        accountId: number;
        transactions: CsvTransaction[];
      }> = [];

      for (const [key, txns] of groups) {
        const [providerStr, accountNumber] = key.split("\0");

        // Try alias first, then companyId
        let provider: Provider | null = getProviderByAlias(providerStr);
        if (!provider) {
          provider = getProviderByCompanyId(providerStr);
        }

        if (!provider) {
          const providers = resolveProviders(providerStr);
          if (providers.length === 1) {
            provider = providers[0];
          } else if (providers.length > 1) {
            printError("AMBIGUOUS_PROVIDER",
              `'${providerStr}' matches multiple providers. Use the alias to be specific.`);
            process.exit(ExitCode.BadArgs);
          } else {
            printError("UNKNOWN_PROVIDER",
              `Provider '${providerStr}' not found. Add it first with 'kolshek providers add'.`);
            process.exit(ExitCode.BadArgs);
          }
        }

        const account = upsertAccount(provider.id, accountNumber, provider.companyId);

        resolvedGroups.push({
          provider,
          accountNumber,
          accountId: account.id,
          transactions: txns,
        });
      }

      // Build TransactionInputs and check dedup
      let newCount = 0;
      let dupCount = 0;
      let updateCount = 0;

      const inputs = resolvedGroups.flatMap((group) =>
        group.transactions.map((csvTx) => ({
          input: buildTransactionInput(csvTx, group.accountId, group.provider.companyId, group.accountNumber),
          csvTx,
        })),
      );

      // Preview
      if (!isJsonMode()) {
        info(`Parsed ${validation.transactions.length} transactions from ${file}`);
        if (validation.errors.length > 0) {
          info(`Skipped ${validation.errors.length} rows with errors`);
        }
        info(`Providers: ${resolvedGroups.map((g) => g.provider.alias).join(", ")}`);
      }

      if (opts.dryRun) {
        // Dry run: check each against DB without writing
        const db = getDatabase();
        for (const { input } of inputs) {
          const existing = db
            .prepare(
              "SELECT id FROM transactions WHERE account_id = $accountId AND hash = $hash",
            )
            .get({ $accountId: input.accountId, $hash: input.hash });

          if (existing) {
            dupCount++;
          } else {
            newCount++;
          }
        }

        if (isJsonMode()) {
          printJson(jsonSuccess({
            dryRun: true,
            totalRows: validation.transactions.length + validation.errors.length,
            valid: validation.transactions.length,
            new: newCount,
            duplicates: dupCount,
            errors: validation.errors.length,
            skippedErrors: validation.errors,
          }));
        } else {
          console.log(createTable(["Metric", "Count"], [
            ["Total rows", String(validation.transactions.length + validation.errors.length)],
            ["Valid", String(validation.transactions.length)],
            ["New (would import)", String(newCount)],
            ["Duplicates (skip)", String(dupCount)],
            ["Errors (skipped)", String(validation.errors.length)],
          ]));
          info("Dry run complete. No changes were made.");
        }
        return;
      }

      // Confirm if interactive
      if (isInteractive()) {
        const { confirm } = await import("@inquirer/prompts");
        const proceed = await confirm({
          message: `Import ${validation.transactions.length} transactions?`,
          default: true,
        });
        if (!proceed) {
          info("Import cancelled.");
          return;
        }
      }

      // Execute import in a DB transaction
      const db = getDatabase();
      db.run("BEGIN");
      try {
        for (const { input } of inputs) {
          const result = upsertTransaction(input);
          if (result.action === "inserted") newCount++;
          else if (result.action === "updated") updateCount++;
          else dupCount++;
        }
        db.run("COMMIT");
      } catch (err) {
        db.run("ROLLBACK");
        printError("IMPORT_ERROR", `Import failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(ExitCode.Error);
      }

      if (isJsonMode()) {
        printJson(jsonSuccess({
          file,
          totalRows: validation.transactions.length + validation.errors.length,
          imported: newCount,
          updated: updateCount,
          duplicates: dupCount,
          errors: validation.errors.length,
          skippedErrors: opts.skipErrors ? validation.errors : [],
        }));
      } else {
        console.log(createTable(["Metric", "Count"], [
          ["Imported (new)", String(newCount)],
          ["Updated (pending→completed)", String(updateCount)],
          ["Duplicates (skipped)", String(dupCount)],
          ["Errors (skipped)", String(validation.errors.length)],
        ]));
        info(`Successfully imported ${newCount + updateCount} transactions.`);
      }
    });
}

// Group CSV transactions by "provider\0account_number"
function groupByProviderAccount(
  transactions: CsvTransaction[],
): Map<string, CsvTransaction[]> {
  const groups = new Map<string, CsvTransaction[]>();
  for (const tx of transactions) {
    const key = `${tx.provider}\0${tx.accountNumber}`;
    const list = groups.get(key);
    if (list) {
      list.push(tx);
    } else {
      groups.set(key, [tx]);
    }
  }
  return groups;
}
