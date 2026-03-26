import { describe, it, expect } from "vitest";
import {
  parseCsvText,
  validateHeaders,
  parseRow,
  validateCsvImport,
} from "../../src/core/csv-import.js";

// ---------------------------------------------------------------------------
// parseCsvText
// ---------------------------------------------------------------------------

describe("parseCsvText", () => {
  it("parses basic CSV with headers and rows", () => {
    const text = "date,description,charged_amount,provider,account_number\n2025-01-15,Shufersal,-120.5,hapoalim,12345";
    const { headers, rows } = parseCsvText(text);
    expect(headers).toEqual(["date", "description", "charged_amount", "provider", "account_number"]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(["2025-01-15", "Shufersal", "-120.5", "hapoalim", "12345"]);
  });

  it("strips BOM from start of file", () => {
    const text = "\uFEFFdate,description\n2025-01-15,Test";
    const { headers } = parseCsvText(text);
    expect(headers[0]).toBe("date");
  });

  it("handles quoted fields with commas", () => {
    const text = 'date,description,charged_amount\n2025-01-15,"Shufersal, Branch 42",-50';
    const { rows } = parseCsvText(text);
    expect(rows[0][1]).toBe("Shufersal, Branch 42");
  });

  it("handles escaped quotes inside quoted fields", () => {
    const text = 'date,description\n2025-01-15,"He said ""hello"""';
    const { rows } = parseCsvText(text);
    expect(rows[0][1]).toBe('He said "hello"');
  });

  it("handles CRLF line endings", () => {
    const text = "date,description\r\n2025-01-15,A\r\n2025-01-16,B";
    const { rows } = parseCsvText(text);
    expect(rows).toHaveLength(2);
  });

  it("skips empty lines", () => {
    const text = "date,description\n2025-01-15,A\n\n2025-01-16,B\n";
    const { rows } = parseCsvText(text);
    expect(rows).toHaveLength(2);
  });

  it("normalizes headers to lowercase", () => {
    const text = "Date,DESCRIPTION,Charged_Amount\n2025-01-15,Test,-50";
    const { headers } = parseCsvText(text);
    expect(headers).toEqual(["date", "description", "charged_amount"]);
  });

  it("returns empty for empty input", () => {
    const { headers, rows } = parseCsvText("");
    expect(headers).toEqual([]);
    expect(rows).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// validateHeaders
// ---------------------------------------------------------------------------

describe("validateHeaders", () => {
  it("passes with all required columns present", () => {
    const result = validateHeaders(["date", "description", "charged_amount", "provider", "account_number"]);
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("passes with extra optional columns", () => {
    const result = validateHeaders(["date", "description", "charged_amount", "provider", "account_number", "memo", "category"]);
    expect(result.valid).toBe(true);
  });

  it("fails when required column is missing", () => {
    const result = validateHeaders(["date", "description", "charged_amount"]);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain("provider");
    expect(result.missing).toContain("account_number");
  });

  it("fails with empty headers", () => {
    const result = validateHeaders([]);
    expect(result.valid).toBe(false);
    expect(result.missing).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// parseRow
// ---------------------------------------------------------------------------

describe("parseRow", () => {
  const headers = ["date", "description", "charged_amount", "provider", "account_number", "memo", "category"];

  it("parses a valid row with all required fields", () => {
    const row = ["2025-01-15", "Shufersal", "-120.5", "hapoalim", "12345", "", ""];
    const result = parseRow(row, headers, 2);
    expect("tx" in result).toBe(true);
    if ("tx" in result) {
      expect(result.tx.description).toBe("Shufersal");
      expect(result.tx.chargedAmount).toBe(-120.5);
      expect(result.tx.provider).toBe("hapoalim");
      expect(result.tx.accountNumber).toBe("12345");
      expect(result.tx.chargedCurrency).toBe("ILS");
      expect(result.tx.status).toBe("completed");
      expect(result.tx.type).toBe("normal");
    }
  });

  it("returns error for missing date", () => {
    const row = ["", "Shufersal", "-120.5", "hapoalim", "12345", "", ""];
    const result = parseRow(row, headers, 2);
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.column).toBe("date");
    }
  });

  it("returns error for invalid date", () => {
    const row = ["not-a-date", "Shufersal", "-120.5", "hapoalim", "12345", "", ""];
    const result = parseRow(row, headers, 2);
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.column).toBe("date");
      expect(result.error.message).toContain("Invalid date");
    }
  });

  it("returns error for invalid amount", () => {
    const row = ["2025-01-15", "Shufersal", "abc", "hapoalim", "12345", "", ""];
    const result = parseRow(row, headers, 2);
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.column).toBe("charged_amount");
    }
  });

  it("returns error for missing description", () => {
    const row = ["2025-01-15", "", "-120.5", "hapoalim", "12345", "", ""];
    const result = parseRow(row, headers, 2);
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.column).toBe("description");
    }
  });

  it("parses DD/MM/YYYY date format", () => {
    const row = ["15/01/2025", "Shufersal", "-120.5", "hapoalim", "12345", "", ""];
    const result = parseRow(row, headers, 2);
    expect("tx" in result).toBe(true);
    if ("tx" in result) {
      expect(result.tx.date).toContain("2025");
    }
  });

  it("preserves optional fields when present", () => {
    const row = ["2025-01-15", "Shufersal", "-120.5", "hapoalim", "12345", "Branch 42", "Groceries"];
    const result = parseRow(row, headers, 2);
    expect("tx" in result).toBe(true);
    if ("tx" in result) {
      expect(result.tx.memo).toBe("Branch 42");
      expect(result.tx.category).toBe("Groceries");
    }
  });

  it("defaults optional fields to null/ILS when absent", () => {
    const row = ["2025-01-15", "Shufersal", "-120.5", "hapoalim", "12345", "", ""];
    const result = parseRow(row, headers, 2);
    expect("tx" in result).toBe(true);
    if ("tx" in result) {
      expect(result.tx.memo).toBeNull();
      expect(result.tx.category).toBeNull();
      expect(result.tx.chargedCurrency).toBe("ILS");
      expect(result.tx.descriptionEn).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// validateCsvImport
// ---------------------------------------------------------------------------

describe("validateCsvImport", () => {
  it("parses a valid CSV and returns transactions", () => {
    const csv = [
      "date,description,charged_amount,provider,account_number",
      "2025-01-15,Shufersal,-120.5,hapoalim,12345",
      "2025-01-16,Rami Levy,-85.0,hapoalim,12345",
    ].join("\n");

    const result = validateCsvImport(csv);
    expect(result.transactions).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
    expect(result.transactions[0].description).toBe("Shufersal");
    expect(result.transactions[1].description).toBe("Rami Levy");
  });

  it("returns errors for invalid rows", () => {
    const csv = [
      "date,description,charged_amount,provider,account_number",
      "2025-01-15,Shufersal,-120.5,hapoalim,12345",
      "bad-date,Rami Levy,-85.0,hapoalim,12345",
    ].join("\n");

    const result = validateCsvImport(csv);
    expect(result.transactions).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].row).toBe(3);
  });

  it("reports missing columns for empty file", () => {
    const result = validateCsvImport("");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("Empty");
  });

  it("reports missing required columns", () => {
    const csv = "date,description\n2025-01-15,Test";
    const result = validateCsvImport(csv);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("Missing required columns");
    expect(result.errors[0].message).toContain("charged_amount");
  });

  it("handles CSV with optional columns", () => {
    const csv = [
      "date,description,charged_amount,provider,account_number,memo,category,charged_currency",
      '2025-01-15,Shufersal,-120.5,hapoalim,12345,Branch 42,Groceries,ILS',
    ].join("\n");

    const result = validateCsvImport(csv);
    expect(result.transactions).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
    expect(result.transactions[0].memo).toBe("Branch 42");
    expect(result.transactions[0].category).toBe("Groceries");
    expect(result.transactions[0].chargedCurrency).toBe("ILS");
  });
});
