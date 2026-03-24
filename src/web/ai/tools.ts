// AI agent tools — database queries + CLI command execution.
// Read tools run in-process for speed. Write operations go through
// the CLI subprocess with --json for full validation and structured output.

import { join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import envPaths from "env-paths";
import { getDatabase } from "../../db/database.js";
import { getMonthlyReport, getCategoryReport, getBalanceReport } from "../../db/repositories/reports.js";
import { searchTransactions } from "../../db/repositories/transactions.js";
import { getSkillByName } from "./skills.js";
import type { ToolDef } from "./types.js";

const configDir = envPaths("kolshek").config;

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

// CLI entry point path (resolved relative to this file: ai/ → web/ → src/ → cli/index.ts)
const CLI_ENTRY = join(import.meta.dir, "..", "..", "cli", "index.ts");

// Commands blocked from agent execution (destructive or interactive)
const BLOCKED_COMMANDS = new Set(["init", "fetch", "dashboard", "update", "schedule", "plugin"]);

// Full tool definitions — used by cloud providers with large context
export const TOOL_DEFS_FULL: ToolDef[] = [
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
      description: "Get full CREATE TABLE statements. The compact schema is already in your system prompt — only call this if you need exact constraints, indexes, or column defaults.",
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
  {
    type: "function",
    function: {
      name: "run_command",
      description: `Run a KolShek CLI command. Returns JSON output. Use this for write operations and advanced commands.

Available commands:
- categorize rule add <category> --description <pattern> [--mode substring|exact|regex] [--memo <pattern>] [--direction debit|credit] [--amount-min N] [--amount-max N] [--priority N]
- categorize rule list
- categorize rule remove <id>
- categorize apply [--scope uncategorized|all] [--dry-run]
- categorize rename <old> <new> [--dry-run]
- categorize reassign --pattern <pattern> --to <category> [--dry-run]
- categorize list
- categorize classify set <category> <classification>
- translate rule add <english> --match <hebrew_pattern>
- translate rule list
- translate rule remove <id>
- translate apply
- transactions list [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--category <cat>] [--limit N]
- transactions set-category <id> <category>
- accounts
- reports monthly [--from YYYY-MM-DD] [--to YYYY-MM-DD]
- reports category [--from YYYY-MM-DD] [--to YYYY-MM-DD]
- spending [month] [--by category|merchant|provider]
- income [month]
- trends [months]
- insights

Examples:
  categorize rule add Groceries --description "שופרסל" --mode substring
  translate rule add "Shufersal" --match "שופרסל"
  categorize apply --scope uncategorized
  transactions set-category 42 Groceries`,
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The CLI command and arguments (without the 'kolshek' prefix). Example: 'categorize rule add Groceries --description \"שופרסל\"'",
          },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "load_skill",
      description: "Load detailed domain knowledge for a topic. Call this when you need reference material about financial analysis patterns, categorization, budgeting, Hebrew descriptions, or CLI commands.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Skill name from the available skills list (e.g. 'analysis', 'categories', 'cli-reference')" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read a file from the KolShek config directory (budget.toml, rules, etc.). Only files in the config directory are accessible.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Filename relative to config dir (e.g. 'budget.toml')" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Write a file to the KolShek config directory (budget.toml, etc.). Only files in the config directory are accessible.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Filename relative to config dir (e.g. 'budget.toml')" },
          content: { type: "string", description: "File content to write" },
        },
        required: ["path", "content"],
      },
    },
  },
];

// Compact tool set for local models — 3 core tools instead of 10.
// Fewer tools = faster prompt evaluation + more reliable tool selection.
// The model can do everything via query + run_command + load_skill.
export const TOOL_DEFS_LOCAL: ToolDef[] = [
  {
    type: "function",
    function: {
      name: "query",
      description: "Read-only SQL on the finance DB. Tables: transactions, accounts, providers, categories, category_rules. Use load_skill('schema') for full schema.",
      parameters: {
        type: "object",
        properties: {
          sql: { type: "string", description: "SELECT statement" },
        },
        required: ["sql"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_command",
      description: "Run a CLI command for writes. Examples: 'categorize rule add Food --description \"שופרסל\"', 'spending 2025-03', 'insights', 'transactions set-category 42 Food'.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Command without 'kolshek' prefix" },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "load_skill",
      description: "Load reference material: schema, analysis, categories, budgeting, hebrew, cli-reference.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Skill name" },
        },
        required: ["name"],
      },
    },
  },
];

// Default export — local models use compact set, cloud uses full
export const TOOL_DEFS = TOOL_DEFS_LOCAL;

// Allowed extensions for config file access
const ALLOWED_EXTENSIONS = new Set([".toml", ".json", ".md"]);

// Validate a config file path — must be a flat filename with allowed extension, no traversal
function validateConfigPath(path: string): string | null {
  if (!path || path.includes("..") || path.includes("/") || path.includes("\\")) {
    return "Path traversal is not allowed. Use a simple filename like 'budget.toml'";
  }
  const ext = "." + path.split(".").pop();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return `File extension ${ext} is not allowed. Allowed: ${[...ALLOWED_EXTENSIONS].join(", ")}`;
  }
  return null;
}

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
      case "run_command":
        return executeRunCommand(args.command as string);
      case "load_skill":
        return executeLoadSkill(args.name as string);
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return JSON.stringify({ error: msg });
  }
}

// Async version for tools that need subprocess or file I/O
export async function executeToolAsync(name: string, args: Record<string, unknown>): Promise<string> {
  if (name === "run_command") {
    return await executeRunCommandAsync(args.command as string);
  }
  if (name === "read_file") {
    return await executeReadFile(args.path as string);
  }
  if (name === "write_file") {
    return await executeWriteFile(args.path as string, args.content as string);
  }
  // All other tools are synchronous
  return executeTool(name, args);
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
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name NOT GLOB '_*' ORDER BY name")
    .all() as Array<{ sql: string }>;
  const schemas = tables.map((t) => t.sql);
  return capResult({ tables: schemas, count: schemas.length });
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

// Synchronous wrapper — should not be called, use executeToolAsync instead
function executeRunCommand(_command: string): string {
  return JSON.stringify({ error: "run_command requires async execution" });
}

// Parse a command string into argv tokens (handles quoted strings)
function parseCommandArgs(command: string): string[] {
  const args: string[] = [];
  let current = "";
  let inQuote: string | null = null;

  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (inQuote) {
      if (ch === inQuote) {
        inQuote = null;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = ch;
    } else if (ch === " " || ch === "\t") {
      if (current) {
        args.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }
  if (current) args.push(current);
  return args;
}

async function executeRunCommandAsync(command: string): Promise<string> {
  if (!command || !command.trim()) {
    return JSON.stringify({ error: "command is required" });
  }

  const argv = parseCommandArgs(command.trim());
  const rootCmd = argv[0];

  if (BLOCKED_COMMANDS.has(rootCmd)) {
    return JSON.stringify({ error: `Command "${rootCmd}" is not available from the agent. Blocked commands: ${[...BLOCKED_COMMANDS].join(", ")}` });
  }

  try {
    const proc = Bun.spawn(["bun", "run", CLI_ENTRY, "--json", "--non-interactive", ...argv], {
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env },
    });

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      // Try to parse JSON error from stdout first (--json mode outputs there)
      if (stdout.trim()) {
        try {
          JSON.parse(stdout.trim());
          return capResult(stdout.trim());
        } catch {
          // not JSON
        }
      }
      return JSON.stringify({
        error: `Command failed (exit ${exitCode})`,
        stderr: stderr.slice(0, 1000) || undefined,
        stdout: stdout.slice(0, 1000) || undefined,
      });
    }

    // Return the JSON output from the CLI
    const output = stdout.trim();
    if (!output) {
      return JSON.stringify({ success: true, message: "Command completed with no output" });
    }

    return capResult(output);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return JSON.stringify({ error: `Failed to run command: ${msg}` });
  }
}

function executeLoadSkill(name: string): string {
  if (!name) return JSON.stringify({ error: "skill name is required" });
  const skill = getSkillByName(name);
  if (!skill) return JSON.stringify({ error: `Unknown skill: "${name}". Use a name from the available skills list.` });
  return JSON.stringify({ name: skill.name, content: skill.content });
}

async function executeReadFile(path: string): Promise<string> {
  const error = validateConfigPath(path);
  if (error) return JSON.stringify({ error });

  const fullPath = join(configDir, path);
  try {
    const content = await readFile(fullPath, "utf-8");
    return JSON.stringify({ path, content });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return JSON.stringify({ error: `File not found: ${path}` });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return JSON.stringify({ error: msg });
  }
}

async function executeWriteFile(path: string, content: string): Promise<string> {
  const error = validateConfigPath(path);
  if (error) return JSON.stringify({ error });

  if (content === undefined || content === null) {
    return JSON.stringify({ error: "content is required" });
  }

  const fullPath = join(configDir, path);
  try {
    await writeFile(fullPath, content, "utf-8");
    return JSON.stringify({ success: true, path, bytes: content.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return JSON.stringify({ error: `Failed to write file: ${msg}` });
  }
}
