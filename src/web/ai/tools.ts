// AI agent tools — read-only database queries exposed to the LLM.
// Reuses SQL validation logic from src/cli/commands/query.ts.

import { getDatabase } from "../../db/database.js";
import { getMonthlyReport, getCategoryReport, getBalanceReport } from "../../db/repositories/reports.js";
import { searchTransactions } from "../../db/repositories/transactions.js";
import type { ToolDef } from "./types.js";

// Read-only SQL keywords that may start a query
const READONLY_PREFIXES = /^\s*(SELECT|WITH|EXPLAIN|PRAGMA|VALUES)\b/i;

const SAFE_PRAGMAS = /^\s*PRAGMA\s+(table_info|table_list|index_list|index_info|database_list|compile_options|journal_mode|page_count|page_size|freelist_count|integrity_check|quick_check|foreign_key_list|foreign_key_check|collation_list)\b/i;

// Validate read-only SQL (mirrors src/cli/commands/query.ts logic)
function validateSql(sql: string): string | null {
  let cleaned = sql.trim();
  while (cleaned.endsWith(";")) {
    cleaned = cleaned.slice(0, -1).trim();
  }

  if (cleaned.includes(";")) {
    return "Multi-statement queries are not allowed";
  }

  if (/\b_migrations\b/i.test(cleaned)) {
    return "Access to internal tables is not allowed";
  }

  if (!READONLY_PREFIXES.test(cleaned)) {
    return "Only read-only queries (SELECT, WITH, EXPLAIN) are allowed";
  }

  if (/^\s*PRAGMA\b/i.test(cleaned)) {
    if (cleaned.includes("=")) {
      return "PRAGMA setters (with =) are not allowed";
    }
    if (!SAFE_PRAGMAS.test(cleaned)) {
      return "Only read-only PRAGMAs are allowed";
    }
  }

  return null;
}

// Cap a JSON result string to a max byte size
function capResult(data: unknown, maxBytes: number = 8192): string {
  const json = JSON.stringify(data);
  if (json.length <= maxBytes) return json;
  return json.slice(0, maxBytes) + "\n...(truncated)";
}

// Tool definitions sent to the LLM
export const TOOL_DEFS: ToolDef[] = [
  {
    type: "function",
    function: {
      name: "query",
      description: "Run a read-only SQL query against the KolShek SQLite database. Only SELECT/WITH statements allowed. Returns JSON array of rows. Use get_schema first to discover table structure.",
      parameters: {
        type: "object",
        properties: {
          sql: {
            type: "string",
            description: "A read-only SQL SELECT statement. Auto-limited to 200 rows if no LIMIT specified.",
          },
        },
        required: ["sql"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_schema",
      description: "Get the database schema (CREATE TABLE statements). Call this first to understand table structure before writing queries.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "monthly_report",
      description: "Get monthly income/expense/net summary. Returns one row per month with totals.",
      parameters: {
        type: "object",
        properties: {
          from: { type: "string", description: "Start date (YYYY-MM-DD). Omit for all time." },
          to: { type: "string", description: "End date (YYYY-MM-DD). Omit for all time." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "category_report",
      description: "Get spending breakdown by category. Returns categories sorted by total amount.",
      parameters: {
        type: "object",
        properties: {
          from: { type: "string", description: "Start date (YYYY-MM-DD). Omit for all time." },
          to: { type: "string", description: "End date (YYYY-MM-DD). Omit for all time." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_transactions",
      description: "Search transactions by keyword (matches description, description_en, memo, category). Returns matching transactions.",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "Search keyword" },
          limit: { type: "number", description: "Max results (default 20)" },
        },
        required: ["keyword"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_accounts",
      description: "List all linked bank/credit card accounts with balances, recent activity, and provider info.",
      parameters: { type: "object", properties: {} },
    },
  },
];

// Tool executor — runs a named tool with parsed arguments, returns result string
export function executeTool(name: string, args: Record<string, unknown>): string {
  try {
    switch (name) {
      case "query":
        return executeQuery(args.sql as string);
      case "get_schema":
        return executeGetSchema();
      case "monthly_report":
        return executeMonthlyReport(args.from as string | undefined, args.to as string | undefined);
      case "category_report":
        return executeCategoryReport(args.from as string | undefined, args.to as string | undefined);
      case "search_transactions":
        return executeSearchTransactions(args.keyword as string, args.limit as number | undefined);
      case "list_accounts":
        return executeListAccounts();
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return JSON.stringify({ error: msg });
  }
}

function executeQuery(sql: string): string {
  const error = validateSql(sql);
  if (error) return JSON.stringify({ error });

  let cleaned = sql.trim();
  while (cleaned.endsWith(";")) {
    cleaned = cleaned.slice(0, -1).trim();
  }

  // Auto-append LIMIT if not present (skip for PRAGMA/VALUES)
  const isPragmaOrValues = /^\s*(PRAGMA|VALUES)\b/i.test(cleaned);
  if (!isPragmaOrValues && !/\bLIMIT\b/i.test(cleaned)) {
    cleaned = `${cleaned} LIMIT 200`;
  }

  const db = getDatabase();
  const stmt = db.prepare(cleaned);

  // Secondary check: write statements produce no columns in bun:sqlite
  if (stmt.columnNames.length === 0) {
    return JSON.stringify({ error: "Only read-only (SELECT) queries are allowed" });
  }

  const rows = stmt.all() as Record<string, unknown>[];
  return capResult({ rows, count: rows.length });
}

function executeGetSchema(): string {
  const db = getDatabase();
  const tables = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '_%' ORDER BY name")
    .all() as Array<{ sql: string }>;
  return tables.map((t) => t.sql).join(";\n\n");
}

function executeMonthlyReport(from?: string, to?: string): string {
  const rows = getMonthlyReport({ from, to });
  return capResult(rows);
}

function executeCategoryReport(from?: string, to?: string): string {
  const rows = getCategoryReport({ from, to });
  return capResult(rows);
}

function executeSearchTransactions(keyword: string, limit?: number): string {
  const results = searchTransactions(keyword, { limit: limit ?? 20 });
  return capResult(results);
}

function executeListAccounts(): string {
  const rows = getBalanceReport();
  return capResult(rows);
}
