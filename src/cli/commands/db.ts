/**
 * kolshek db — Schema introspection for AI agents.
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

const ALLOWED_TABLES = ["providers", "accounts", "transactions", "sync_log"];

interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

export function registerDbCommand(program: Command): void {
  const dbCmd = program
    .command("db")
    .description("Inspect database schema (tables and columns)");

  // --- db tables ---
  dbCmd
    .command("tables")
    .description("List available tables")
    .action(() => {
      if (isJsonMode()) {
        printJson(jsonSuccess({ tables: ALLOWED_TABLES }));
        return;
      }

      const table = createTable(
        ["Table"],
        ALLOWED_TABLES.map((t) => [t]),
      );
      console.log(table);
      info(`\n${ALLOWED_TABLES.length} table(s) available.`);
    });

  // --- db schema ---
  dbCmd
    .command("schema <table>")
    .description("Show column details for a table")
    .action((tableName: string) => {
      if (!ALLOWED_TABLES.includes(tableName) || !/^[a-z_]+$/.test(tableName)) {
        printError("BAD_ARGS", `Unknown table: ${tableName}`, {
          suggestions: [`Available tables: ${ALLOWED_TABLES.join(", ")}`],
        });
        process.exit(ExitCode.BadArgs);
      }

      const db = getDatabase();
      const columns = db
        .prepare(`PRAGMA table_info(${tableName})`)
        .all() as ColumnInfo[];

      if (isJsonMode()) {
        printJson(
          jsonSuccess({
            table: tableName,
            columns: columns.map((c) => ({
              name: c.name,
              type: c.type,
              nullable: c.notnull === 0,
              defaultValue: c.dflt_value,
              primaryKey: c.pk > 0,
            })),
          }),
        );
        return;
      }

      const table = createTable(
        ["Column", "Type", "Nullable", "Default", "PK"],
        columns.map((c) => [
          c.name,
          c.type,
          c.notnull === 0 ? "yes" : "no",
          c.dflt_value ?? "",
          c.pk > 0 ? "✓" : "",
        ]),
      );
      console.log(table);
      info(`\nTable "${tableName}" — ${columns.length} column(s).`);
    });
}
