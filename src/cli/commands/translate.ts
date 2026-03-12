// kolshek translate — Manage translation rules and apply them to transactions.

import type { Command } from "commander";
import {
  addTranslationRule,
  listTranslationRules,
  removeTranslationRule,
  applyTranslationRules,
  seedTranslationRules,
  bulkImportTranslationRules,
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
  ruleCmd
    .command("import [file]")
    .description(
      "Bulk-import translation rules from a JSON file or stdin. " +
      'Format: [{"englishName": "...", "matchPattern": "..."}]',
    )
    .action(async (filePath?: string) => {
      let rawJson: string;

      if (filePath) {
        const file = Bun.file(filePath);
        if (!(await file.exists())) {
          printError("NOT_FOUND", `File not found: ${filePath}`);
          process.exit(ExitCode.BadArgs);
        }
        rawJson = await file.text();
      } else {
        if (process.stdin.isTTY) {
          printError(
            "BAD_ARGS",
            "No file specified and stdin is a terminal. " +
            "Pipe JSON or provide a file path.\n" +
            '  Example: echo \'[{"englishName":"Store","matchPattern":"חנות"}]\' | kolshek tr rule import',
          );
          process.exit(ExitCode.BadArgs);
        }
        rawJson = await new Response(Bun.stdin.stream()).text();
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawJson);
      } catch {
        printError("BAD_ARGS", "Invalid JSON input");
        process.exit(ExitCode.BadArgs);
      }

      if (!Array.isArray(parsed)) {
        printError("BAD_ARGS", "JSON must be an array of rule objects");
        process.exit(ExitCode.BadArgs);
      }

      const rules: Array<{ englishName: string; matchPattern: string }> = [];
      for (const [i, entry] of parsed.entries()) {
        if (
          typeof entry !== "object" || entry === null ||
          typeof (entry as Record<string, unknown>).englishName !== "string" ||
          typeof (entry as Record<string, unknown>).matchPattern !== "string"
        ) {
          printError(
            "BAD_ARGS",
            `Invalid rule at index ${i}: each entry needs "englishName" and "matchPattern" strings`,
          );
          process.exit(ExitCode.BadArgs);
        }
        const e = entry as { englishName: string; matchPattern: string };
        if (!e.matchPattern.trim() || !e.englishName.trim()) {
          printError("BAD_ARGS", `Empty name or pattern at index ${i}`);
          process.exit(ExitCode.BadArgs);
        }
        rules.push({ englishName: e.englishName, matchPattern: e.matchPattern });
      }

      const result = bulkImportTranslationRules(rules);

      if (isJsonMode()) {
        printJson(jsonSuccess(result));
        return;
      }

      success(`Imported ${result.imported} rule(s), skipped ${result.skipped} duplicate(s).`);
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
