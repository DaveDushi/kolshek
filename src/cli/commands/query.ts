/**
 * kolshek query — Ad-hoc read-only SQL for escape-hatch analysis.
 */

import type { Command } from "commander";
import { getDatabase } from "../../db/database.js";
import {
  isJsonMode,
  printJson,
  jsonSuccess,
  printError,
  info,
  createTable,
  ExitCode,
} from "../output.js";

/** Read-only SQL keywords that may start a query */
const READONLY_PREFIXES = /^\s*(SELECT|WITH|EXPLAIN|PRAGMA|VALUES)\b/i;

// PRAGMAs that are safe to read (return data, don't mutate state).
// Must NOT contain '=' (which makes a pragma a setter/mutation).
const SAFE_PRAGMAS = /^\s*PRAGMA\s+(table_info|table_list|index_list|index_info|database_list|compile_options|journal_mode|page_count|page_size|freelist_count|integrity_check|quick_check|foreign_key_list|foreign_key_check|collation_list)\b/i;

/** Validate and sanitize user SQL */
function validateSql(sql: string): string | null {
  // Strip trailing semicolons and whitespace
  let cleaned = sql.trim();
  while (cleaned.endsWith(";")) {
    cleaned = cleaned.slice(0, -1).trim();
  }

  // Block multi-statement (any remaining semicolons)
  if (cleaned.includes(";")) {
    return "Multi-statement queries are not allowed";
  }

  // Block _migrations table access
  if (/\b_migrations\b/i.test(cleaned)) {
    return "Access to internal tables is not allowed";
  }

  // Must start with a read-only keyword
  if (!READONLY_PREFIXES.test(cleaned)) {
    return "Only read-only queries (SELECT, WITH, EXPLAIN) are allowed";
  }

  // Block mutating PRAGMAs — only allow known safe read-only ones.
  // Any PRAGMA with '=' is a setter (mutation), always block it.
  if (/^\s*PRAGMA\b/i.test(cleaned)) {
    if (cleaned.includes("=")) {
      return "PRAGMA setters (with =) are not allowed — only read-only PRAGMAs";
    }
    if (!SAFE_PRAGMAS.test(cleaned)) {
      return "Only read-only PRAGMAs are allowed (table_info, index_list, etc.)";
    }
  }

  return null;
}

export function registerQueryCommand(program: Command): void {
  program
    .command("query <sql>")
    .alias("sql")
    .description("Run a read-only SQL query (SELECT, WITH, EXPLAIN, PRAGMA, VALUES). Use 'kolshek db tables' to discover available tables.")
    .option("--limit <n>", "Maximum rows to return", parseInt)
    .action((sql: string, opts: { limit?: number }) => {
      // Validate
      const error = validateSql(sql);
      if (error) {
        printError("BAD_QUERY", error, {
          suggestions: ["Only single SELECT statements are allowed"],
        });
        process.exit(ExitCode.BadArgs);
      }

      // Clean trailing semicolons
      let cleaned = sql.trim();
      while (cleaned.endsWith(";")) {
        cleaned = cleaned.slice(0, -1).trim();
      }

      // Auto-append LIMIT if not present (skip for PRAGMA/VALUES which don't support it)
      const isPragmaOrValues = /^\s*(PRAGMA|VALUES)\b/i.test(cleaned);
      if (!isPragmaOrValues) {
        const limit = opts.limit ?? 100;
        if (!/\bLIMIT\b/i.test(cleaned)) {
          cleaned = `${cleaned} LIMIT ${limit}`;
        }
      }

      const db = getDatabase();

      let stmt;
      try {
        stmt = db.prepare(cleaned);
      } catch (err) {
        printError(
          "BAD_QUERY",
          err instanceof Error ? err.message : String(err),
        );
        process.exit(ExitCode.BadArgs);
      }

      // Secondary check: write statements produce no columns in bun:sqlite
      if (stmt.columnNames.length === 0) {
        printError("BAD_QUERY", "Only read-only (SELECT) queries are allowed", {
          suggestions: [
            "Use SELECT statements only",
            "Write operations are not permitted",
          ],
        });
        process.exit(ExitCode.BadArgs);
      }

      let rows: Record<string, unknown>[];
      try {
        rows = stmt.all() as Record<string, unknown>[];
      } catch (err) {
        printError(
          "QUERY_ERROR",
          err instanceof Error ? err.message : String(err),
        );
        process.exit(ExitCode.Error);
      }

      if (isJsonMode()) {
        printJson(
          jsonSuccess({
            rows,
            count: rows.length,
            sql: cleaned,
          }),
        );
        return;
      }

      if (rows.length === 0) {
        info("No results.");
        return;
      }

      // Auto-generate table from result columns
      const columns = Object.keys(rows[0]);
      const tableRows = rows.map((row) =>
        columns.map((col) => {
          const val = row[col];
          if (val === null || val === undefined) return "";
          const str = String(val);
          return str.length > 60 ? str.slice(0, 57) + "..." : str;
        }),
      );

      const table = createTable(columns, tableRows);
      console.log(table);
      info(`\n${rows.length} row(s).`);
    });
}
