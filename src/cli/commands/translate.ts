// kolshek translate — Manage translation rules and apply them to transactions.

import type { Command } from "commander";
import { z } from "zod";
import {
  addTranslationRule,
  listTranslationRules,
  removeTranslationRule,
  applyTranslationRules,
  seedTranslationRules,
  importTranslationRules,
} from "../../db/repositories/translations.js";
import { MERCHANT_NAMES } from "../../core/merchant-names.js";
import {
  isJsonMode,
  printJson,
  jsonSuccess,
  printError,
  success,
  info,
  createTable,
  ExitCode,
} from "../output.js";

export function registerTranslateCommand(program: Command): void {
  const transCmd = program
    .command("translate")
    .alias("tr")
    .description("Manage Hebrew→English translation rules for transaction descriptions");

  // --- translate rule ---
  const ruleCmd = transCmd
    .command("rule")
    .description("Manage translation rules");

  // --- translate rule add ---
  ruleCmd
    .command("add <english>")
    .description("Create a translation rule")
    .requiredOption("--match <pattern>", "Hebrew substring pattern to match against description")
    .action((english: string, opts) => {
      const pattern = String(opts.match);
      if (!pattern.trim()) {
        printError("BAD_ARGS", "Match pattern cannot be empty");
        process.exit(ExitCode.BadArgs);
      }

      const rule = addTranslationRule(english, pattern);

      if (isJsonMode()) {
        printJson(
          jsonSuccess({
            id: rule.id,
            englishName: rule.englishName,
            matchPattern: rule.matchPattern,
          }),
        );
        return;
      }

      success(`Rule #${rule.id} created: "${pattern}" → ${english}`);
    });

  // --- translate rule list ---
  ruleCmd
    .command("list")
    .description("List all translation rules")
    .action(() => {
      const rules = listTranslationRules();

      if (isJsonMode()) {
        printJson(jsonSuccess({ rules }));
        return;
      }

      if (rules.length === 0) {
        info("No translation rules defined. Use 'kolshek translate rule add' or 'kolshek translate seed' to create rules.");
        return;
      }

      const table = createTable(
        ["ID", "English Name", "Match Pattern", "Created"],
        rules.map((r) => [
          String(r.id),
          r.englishName,
          r.matchPattern,
          r.createdAt,
        ]),
      );
      console.log(table);
      info(`\n${rules.length} rule(s).`);
    });

  // --- translate rule remove ---
  ruleCmd
    .command("remove <id>")
    .description("Delete a translation rule")
    .action((idStr: string) => {
      const id = parseInt(idStr, 10);
      if (isNaN(id)) {
        printError("BAD_ARGS", "Rule ID must be a number");
        process.exit(ExitCode.BadArgs);
      }

      const removed = removeTranslationRule(id);

      if (isJsonMode()) {
        if (removed) {
          printJson(jsonSuccess({ id, removed: true }));
        } else {
          printError("NOT_FOUND", `Rule #${id} not found`);
          process.exit(ExitCode.BadArgs);
        }
        return;
      }

      if (removed) {
        success(`Rule #${id} removed.`);
      } else {
        printError("NOT_FOUND", `Rule #${id} not found`);
        process.exit(ExitCode.BadArgs);
      }
    });

  // --- translate rule import ---
  const translationRuleImportSchema = z.array(
    z.object({
      english: z.string().min(1, "english must be non-empty"),
      match: z.string().min(1, "match must be non-empty"),
    }),
  );

  ruleCmd
    .command("import")
    .description("Import translation rules from a JSON file")
    .requiredOption("--file <path>", "JSON file with translation rule definitions")
    .action(async (opts) => {
      try {
        const file = Bun.file(opts.file);
        const exists = await file.exists();
        if (!exists) {
          printError("FILE_ERROR", `File not found: ${opts.file}`);
          process.exit(ExitCode.Error);
        }

        const text = await file.text();
        let raw: unknown;
        try {
          raw = JSON.parse(text);
        } catch {
          printError("FILE_ERROR", `Invalid JSON in ${opts.file}`);
          process.exit(ExitCode.Error);
        }

        const parsed = translationRuleImportSchema.safeParse(raw);
        if (!parsed.success) {
          printError("BAD_ARGS", `Invalid file format: ${parsed.error.issues[0].message}`, {
            suggestions: [
              'Expected format: [{ "english": "Shufersal", "match": "שופרסל" }, ...]',
            ],
          });
          process.exit(ExitCode.BadArgs);
        }

        const result = importTranslationRules(parsed.data);

        if (isJsonMode()) {
          printJson(jsonSuccess(result));
          return;
        }

        success(`Imported ${result.imported} rule(s), skipped ${result.skipped} duplicate(s).`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        printError("FILE_ERROR", msg);
        process.exit(ExitCode.Error);
      }
    });

  // --- translate apply ---
  transCmd
    .command("apply")
    .description("Run translation rules on transactions with NULL description_en")
    .action(() => {
      const result = applyTranslationRules();

      if (isJsonMode()) {
        printJson(jsonSuccess(result));
        return;
      }

      success(`Applied rules: ${result.applied} transaction(s) translated.`);
    });

  // --- translate seed ---
  transCmd
    .command("seed")
    .description("Import the hardcoded merchant-names dictionary as translation rules")
    .action(() => {
      const result = seedTranslationRules(MERCHANT_NAMES);

      if (isJsonMode()) {
        printJson(jsonSuccess(result));
        return;
      }

      success(`Seeded ${result.seeded} translation rule(s) from merchant-names dictionary.`);
    });
}
