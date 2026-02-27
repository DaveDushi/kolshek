/**
 * Dual-mode output: human-readable tables OR structured JSON.
 */

import chalk from "chalk";
import ora, { type Ora } from "ora";
import Table from "cli-table3";
import { format, parseISO } from "date-fns";

// ---------------------------------------------------------------------------
// Exit codes
// ---------------------------------------------------------------------------

export enum ExitCode {
  Success = 0,
  Error = 1,
  BadArgs = 2,
  AuthFailure = 3,
  Timeout = 4,
  Blocked = 5,
  PartialSuccess = 10,
}

// ---------------------------------------------------------------------------
// Output options (set from global CLI flags)
// ---------------------------------------------------------------------------

export interface OutputOptions {
  json: boolean;
  quiet: boolean;
  noColor: boolean;
  noProgress: boolean;
  nonInteractive: boolean;
}

let _opts: OutputOptions = {
  json: false,
  quiet: false,
  noColor: false,
  noProgress: false,
  nonInteractive: false,
};

export function setOutputOptions(opts: Partial<OutputOptions>): void {
  _opts = { ..._opts, ...opts };
  // Apply environment-based overrides
  if (process.env.CI === "true" || process.env.TERM === "dumb") {
    _opts.noColor = true;
    _opts.noProgress = true;
    _opts.nonInteractive = true;
  }
  if (process.env.NO_COLOR === "1") {
    _opts.noColor = true;
  }
  if (_opts.noColor) {
    chalk.level = 0;
  }
}

export function getOutputOptions(): OutputOptions {
  return _opts;
}

export function isJsonMode(): boolean {
  return _opts.json;
}

export function isInteractive(): boolean {
  return !_opts.nonInteractive && process.stdin.isTTY === true;
}

// ---------------------------------------------------------------------------
// JSON envelope
// ---------------------------------------------------------------------------

interface JsonSuccess<T = unknown> {
  success: true;
  data: T;
  metadata: { timestamp: string; version: string };
}

interface JsonError {
  success: false;
  error: {
    code: string;
    message: string;
    provider?: string;
    retryable: boolean;
    suggestions: string[];
  };
  metadata: { timestamp: string; version: string };
}

import pkg from "../../package.json";

function meta(): { timestamp: string; version: string } {
  return { timestamp: new Date().toISOString(), version: pkg.version };
}

export function jsonSuccess<T>(data: T): JsonSuccess<T> {
  return { success: true, data, metadata: meta() };
}

export function jsonError(
  code: string,
  message: string,
  opts?: { provider?: string; retryable?: boolean; suggestions?: string[] },
): JsonError {
  return {
    success: false,
    error: {
      code,
      message,
      provider: opts?.provider,
      retryable: opts?.retryable ?? false,
      suggestions: opts?.suggestions ?? [],
    },
    metadata: meta(),
  };
}

export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

// ---------------------------------------------------------------------------
// Human formatting
// ---------------------------------------------------------------------------

/** Format ILS amount: ₪1,234.56 with color */
export function formatCurrency(amount: number, currency = "ILS"): string {
  const symbol = currency === "ILS" ? "₪" : currency;
  const formatted = `${symbol}${Math.abs(amount).toLocaleString("en-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (_opts.noColor) return amount < 0 ? `-${formatted}` : formatted;

  if (amount < 0) return chalk.red(`-${formatted}`);
  if (amount > 0) return chalk.green(formatted);
  return formatted;
}

/** Format ISO date string to DD/MM/YY for humans */
export function formatDate(isoDate: string): string {
  try {
    return format(parseISO(isoDate), "dd/MM/yy");
  } catch {
    return isoDate;
  }
}

/** Mask account number: ****1234 for humans, full for JSON */
export function formatAccountNumber(
  accountNumber: string,
  masked = true,
): string {
  if (!masked || accountNumber.length <= 4) return accountNumber;
  return "****" + accountNumber.slice(-4);
}

/** Format installment info: (3/12) */
export function formatInstallments(
  number: number | null,
  total: number | null,
): string {
  if (number == null || total == null) return "";
  return `(${number}/${total})`;
}

// ---------------------------------------------------------------------------
// Table helper
// ---------------------------------------------------------------------------

export function createTable(
  headers: string[],
  rows: string[][],
): string {
  const table = new Table({
    head: _opts.noColor ? headers : headers.map((h) => chalk.bold.cyan(h)),
    style: { head: [], border: [] },
  });
  for (const row of rows) {
    table.push(row);
  }
  return table.toString();
}

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------

export function createSpinner(text: string): Ora {
  return ora({
    text,
    isSilent: _opts.quiet || _opts.noProgress,
  });
}

// ---------------------------------------------------------------------------
// Error sanitization
// ---------------------------------------------------------------------------

/** Strip credential values from an error message to prevent leaks */
export function sanitizeError(
  message: string,
  credentials: Record<string, string>,
): string {
  let safe = message;
  for (const value of Object.values(credentials)) {
    if (value) {
      safe = safe.replaceAll(value, "***");
      safe = safe.replaceAll(encodeURIComponent(value), "***");
    }
  }
  return safe;
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export function info(msg: string): void {
  if (_opts.quiet || _opts.json) return;
  console.log(msg);
}

export function warn(msg: string): void {
  if (_opts.json) return;
  console.error(_opts.noColor ? `Warning: ${msg}` : chalk.yellow(`Warning: ${msg}`));
}

export function success(msg: string): void {
  if (_opts.quiet || _opts.json) return;
  console.log(_opts.noColor ? `✓ ${msg}` : chalk.green(`✓ ${msg}`));
}

export function printError(
  code: string,
  message: string,
  opts?: { provider?: string; retryable?: boolean; suggestions?: string[] },
): void {
  if (_opts.json) {
    printJson(jsonError(code, message, opts));
    return;
  }

  console.error(_opts.noColor ? `Error: ${message}` : chalk.red(`Error: ${message}`));

  if (opts?.provider) {
    console.error(`  Provider: ${opts.provider}`);
  }
  if (opts?.retryable) {
    console.error("  This error may be transient — try again.");
  }
  if (opts?.suggestions?.length) {
    console.error("\n  Suggestions:");
    for (const [i, s] of opts.suggestions.entries()) {
      console.error(`    ${i + 1}. ${s}`);
    }
  }
}
