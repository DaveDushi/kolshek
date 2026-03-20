// Pure CSV import logic — parsing, validation, and transaction building.
// No DB or CLI imports. Operates on plain types only.

import { parseISO, isValid as isValidDate } from "date-fns";
import { transactionHash, transactionUniqueId } from "./sync-engine.js";
import type { TransactionInput, TransactionType, TransactionStatus } from "../types/index.js";

// ---------------------------------------------------------------------------
// CSV format definition
// ---------------------------------------------------------------------------

const REQUIRED_COLUMNS = ["date", "description", "charged_amount", "provider", "account_number"] as const;

// Optional columns (accepted but not required):
// charged_currency, original_amount, original_currency, processed_date,
// status, type, memo, category, description_en, identifier,
// installment_number, installment_total, provider_alias

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CsvTransaction {
  date: string;
  processedDate: string;
  description: string;
  descriptionEn: string | null;
  chargedAmount: number;
  chargedCurrency: string;
  originalAmount: number;
  originalCurrency: string;
  status: TransactionStatus;
  type: TransactionType;
  identifier: string | null;
  memo: string | null;
  category: string | null;
  installmentNumber: number | null;
  installmentTotal: number | null;
  provider: string;
  accountNumber: string;
}

export interface RowError {
  row: number;
  column?: string;
  message: string;
}

export interface CsvImportValidation {
  transactions: CsvTransaction[];
  errors: RowError[];
  headers: string[];
}

export interface HeaderValidation {
  valid: boolean;
  missing: string[];
}

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

export function parseCsvText(text: string): { headers: string[]; rows: string[][] } {
  // Strip BOM
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  const lines = splitCsvLines(text);
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const rows: string[][] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "") continue;
    rows.push(parseCsvLine(line));
  }

  return { headers, rows };
}

// Split text into lines, respecting quoted fields that contain newlines
function splitCsvLines(text: string): string[] {
  const lines: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      lines.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.length > 0) {
    lines.push(current);
  }
  return lines;
}

// Parse a single CSV line into fields
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

// ---------------------------------------------------------------------------
// Header validation
// ---------------------------------------------------------------------------

export function validateHeaders(headers: string[]): HeaderValidation {
  const headerSet = new Set(headers);
  const missing: string[] = [];

  for (const col of REQUIRED_COLUMNS) {
    if (!headerSet.has(col)) {
      missing.push(col);
    }
  }

  return { valid: missing.length === 0, missing };
}

// ---------------------------------------------------------------------------
// Row parsing
// ---------------------------------------------------------------------------

export function parseRow(
  row: string[],
  headers: string[],
  rowIndex: number,
): { tx: CsvTransaction } | { error: RowError } {
  const get = (col: string): string => {
    const idx = headers.indexOf(col);
    if (idx === -1 || idx >= row.length) return "";
    return row[idx].trim();
  };

  // Strip CSV formula protection prefix
  const clean = (val: string): string => {
    if (val.startsWith("'") && /^'[=+\-@\t;]/.test(val)) {
      return val.slice(1);
    }
    return val;
  };

  // Required fields
  const rawDate = clean(get("date"));
  const description = clean(get("description"));
  const rawAmount = get("charged_amount");
  const provider = clean(get("provider"));
  const accountNumber = clean(get("account_number"));

  if (!rawDate) {
    return { error: { row: rowIndex, column: "date", message: "Missing date" } };
  }
  if (!description) {
    return { error: { row: rowIndex, column: "description", message: "Missing description" } };
  }
  if (!rawAmount) {
    return { error: { row: rowIndex, column: "charged_amount", message: "Missing charged_amount" } };
  }
  if (!provider) {
    return { error: { row: rowIndex, column: "provider", message: "Missing provider" } };
  }
  if (!accountNumber) {
    return { error: { row: rowIndex, column: "account_number", message: "Missing account_number" } };
  }

  // Parse date (YYYY-MM-DD, DD/MM/YYYY, or full ISO)
  const date = parseDate(rawDate);
  if (!date) {
    return { error: { row: rowIndex, column: "date", message: `Invalid date: '${rawDate}'` } };
  }

  // Parse amount
  const chargedAmount = Number(rawAmount);
  if (isNaN(chargedAmount)) {
    return { error: { row: rowIndex, column: "charged_amount", message: `Invalid amount: '${rawAmount}'` } };
  }

  // Optional fields
  const chargedCurrency = clean(get("charged_currency")) || "ILS";
  const rawOrigAmount = get("original_amount");
  const originalAmount = rawOrigAmount ? Number(rawOrigAmount) : chargedAmount;
  if (isNaN(originalAmount)) {
    return { error: { row: rowIndex, column: "original_amount", message: `Invalid amount: '${rawOrigAmount}'` } };
  }
  const originalCurrency = clean(get("original_currency")) || chargedCurrency;

  const rawProcessedDate = clean(get("processed_date"));
  const processedDate = rawProcessedDate ? parseDate(rawProcessedDate) : date;
  if (!processedDate) {
    return { error: { row: rowIndex, column: "processed_date", message: `Invalid date: '${rawProcessedDate}'` } };
  }

  const rawStatus = get("status").toLowerCase() || "completed";
  if (rawStatus !== "completed" && rawStatus !== "pending") {
    return { error: { row: rowIndex, column: "status", message: `Invalid status: '${rawStatus}' (must be completed or pending)` } };
  }

  const rawType = get("type").toLowerCase() || "normal";
  if (rawType !== "normal" && rawType !== "installments") {
    return { error: { row: rowIndex, column: "type", message: `Invalid type: '${rawType}' (must be normal or installments)` } };
  }

  const rawInstNum = get("installment_number");
  const installmentNumber = rawInstNum ? Number(rawInstNum) : null;
  const rawInstTotal = get("installment_total");
  const installmentTotal = rawInstTotal ? Number(rawInstTotal) : null;

  return {
    tx: {
      date,
      processedDate,
      description,
      descriptionEn: clean(get("description_en")) || null,
      chargedAmount,
      chargedCurrency,
      originalAmount,
      originalCurrency,
      status: rawStatus as TransactionStatus,
      type: rawType as TransactionType,
      identifier: clean(get("identifier")) || null,
      memo: clean(get("memo")) || null,
      category: clean(get("category")) || null,
      installmentNumber,
      installmentTotal,
      provider,
      accountNumber,
    },
  };
}

// ---------------------------------------------------------------------------
// Date parsing helper
// ---------------------------------------------------------------------------

function parseDate(raw: string): string | null {
  // Try ISO format (YYYY-MM-DD or full ISO datetime)
  const isoDate = parseISO(raw);
  if (isValidDate(isoDate)) {
    return isoDate.toISOString();
  }

  // Try DD/MM/YYYY
  const ddmmyyyy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    const d = new Date(Number(year), Number(month) - 1, Number(day));
    if (isValidDate(d)) {
      return d.toISOString();
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Build TransactionInput from parsed CSV row
// ---------------------------------------------------------------------------

export function buildTransactionInput(
  csvTx: CsvTransaction,
  accountId: number,
  companyId: string,
  accountNumber: string,
): TransactionInput {
  const hash = transactionHash(
    {
      date: csvTx.date,
      chargedAmount: csvTx.chargedAmount,
      description: csvTx.description,
      memo: csvTx.memo,
    },
    companyId,
    accountNumber,
  );

  const uniqueId = transactionUniqueId(
    {
      date: csvTx.date,
      chargedAmount: csvTx.chargedAmount,
      description: csvTx.description,
      memo: csvTx.memo,
      identifier: csvTx.identifier,
    },
    companyId,
    accountNumber,
  );

  return {
    accountId,
    type: csvTx.type,
    identifier: csvTx.identifier,
    date: csvTx.date,
    processedDate: csvTx.processedDate,
    originalAmount: csvTx.originalAmount,
    originalCurrency: csvTx.originalCurrency,
    chargedAmount: csvTx.chargedAmount,
    chargedCurrency: csvTx.chargedCurrency,
    description: csvTx.description,
    descriptionEn: csvTx.descriptionEn,
    memo: csvTx.memo,
    status: csvTx.status,
    installmentNumber: csvTx.installmentNumber,
    installmentTotal: csvTx.installmentTotal,
    category: csvTx.category,
    hash,
    uniqueId,
  };
}

// ---------------------------------------------------------------------------
// Full validation pipeline
// ---------------------------------------------------------------------------

export function validateCsvImport(text: string): CsvImportValidation {
  const { headers, rows } = parseCsvText(text);

  if (headers.length === 0) {
    return { transactions: [], errors: [{ row: 0, message: "Empty CSV file" }], headers: [] };
  }

  const headerCheck = validateHeaders(headers);
  if (!headerCheck.valid) {
    return {
      transactions: [],
      errors: [{ row: 0, message: `Missing required columns: ${headerCheck.missing.join(", ")}` }],
      headers,
    };
  }

  const transactions: CsvTransaction[] = [];
  const errors: RowError[] = [];

  for (let i = 0; i < rows.length; i++) {
    const result = parseRow(rows[i], headers, i + 2); // +2: 1-based + header row
    if ("tx" in result) {
      transactions.push(result.tx);
    } else {
      errors.push(result.error);
    }
  }

  return { transactions, errors, headers };
}
