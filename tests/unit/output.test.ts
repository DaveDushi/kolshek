import { describe, it, expect, beforeEach } from "vitest";
import {
  formatCurrency,
  formatDate,
  formatAccountNumber,
  formatInstallments,
  jsonSuccess,
  jsonError,
  setOutputOptions,
} from "../../src/cli/output.js";

// Disable color for predictable assertions
beforeEach(() => {
  setOutputOptions({ noColor: true });
});

describe("formatCurrency", () => {
  it("formats a positive ILS amount", () => {
    const result = formatCurrency(1234.56);
    expect(result).toContain("1,234.56");
    expect(result).toContain("\u20AA"); // shekel sign
  });

  it("formats a negative ILS amount with minus sign", () => {
    const result = formatCurrency(-89.0);
    expect(result).toMatch(/^-/);
    expect(result).toContain("89.00");
    expect(result).toContain("\u20AA");
  });

  it("formats zero amount without sign", () => {
    const result = formatCurrency(0);
    expect(result).not.toMatch(/^-/);
    expect(result).toContain("0.00");
  });

  it("uses currency code instead of shekel sign for non-ILS", () => {
    const result = formatCurrency(49.99, "USD");
    expect(result).toContain("USD");
    expect(result).not.toContain("\u20AA");
    expect(result).toContain("49.99");
  });

  it("uses currency code for EUR", () => {
    const result = formatCurrency(100.0, "EUR");
    expect(result).toContain("EUR");
    expect(result).toContain("100.00");
  });

  it("formats large amounts with comma separators", () => {
    const result = formatCurrency(15000);
    expect(result).toContain("15,000.00");
  });

  it("formats small decimal amounts correctly", () => {
    const result = formatCurrency(0.5);
    expect(result).toContain("0.50");
  });
});

describe("formatDate", () => {
  it("formats a valid ISO date to DD/MM/YY", () => {
    expect(formatDate("2025-12-01T00:00:00.000Z")).toBe("01/12/25");
  });

  it("formats a date-only ISO string", () => {
    expect(formatDate("2025-01-15")).toBe("15/01/25");
  });

  it("returns the original string for an invalid date", () => {
    expect(formatDate("not-a-date")).toBe("not-a-date");
  });

  it("handles end-of-year date", () => {
    expect(formatDate("2025-12-31T12:00:00.000Z")).toBe("31/12/25");
  });

  it("handles beginning-of-year date", () => {
    expect(formatDate("2025-01-01T00:00:00.000Z")).toBe("01/01/25");
  });
});

describe("formatAccountNumber", () => {
  it("masks long account numbers by default", () => {
    expect(formatAccountNumber("1234567890")).toBe("****7890");
  });

  it("returns full number when masked=false", () => {
    expect(formatAccountNumber("1234567890", false)).toBe("1234567890");
  });

  it("does not mask short numbers (4 chars or fewer)", () => {
    expect(formatAccountNumber("1234")).toBe("1234");
    expect(formatAccountNumber("123")).toBe("123");
  });

  it("masks a 5-character number", () => {
    expect(formatAccountNumber("12345")).toBe("****2345");
  });

  it("handles credit card style numbers", () => {
    expect(formatAccountNumber("4580-1234-5678-9012")).toBe("****9012");
  });
});

describe("formatInstallments", () => {
  it("formats normal installment info", () => {
    expect(formatInstallments(3, 12)).toBe("(3/12)");
  });

  it("formats first installment", () => {
    expect(formatInstallments(1, 6)).toBe("(1/6)");
  });

  it("returns empty string when number is null", () => {
    expect(formatInstallments(null, 12)).toBe("");
  });

  it("returns empty string when total is null", () => {
    expect(formatInstallments(3, null)).toBe("");
  });

  it("returns empty string when both are null", () => {
    expect(formatInstallments(null, null)).toBe("");
  });
});

describe("jsonSuccess", () => {
  it("wraps data in a success envelope", () => {
    const result = jsonSuccess({ count: 5 });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ count: 5 });
  });

  it("includes metadata with timestamp and version", () => {
    const result = jsonSuccess("test");
    expect(result.metadata).toBeDefined();
    expect(result.metadata.timestamp).toBeDefined();
    expect(result.metadata.version).toBeDefined();
    expect(typeof result.metadata.timestamp).toBe("string");
  });

  it("timestamp is a valid ISO string", () => {
    const result = jsonSuccess(null);
    const parsed = new Date(result.metadata.timestamp);
    expect(parsed.getTime()).not.toBeNaN();
  });

  it("handles array data", () => {
    const result = jsonSuccess([1, 2, 3]);
    expect(result.data).toEqual([1, 2, 3]);
  });
});

describe("jsonError", () => {
  it("wraps error in an error envelope", () => {
    const result = jsonError("AUTH_FAILED", "Invalid credentials");
    expect(result.success).toBe(false);
    expect(result.error.code).toBe("AUTH_FAILED");
    expect(result.error.message).toBe("Invalid credentials");
  });

  it("defaults retryable to false", () => {
    const result = jsonError("ERR", "Something broke");
    expect(result.error.retryable).toBe(false);
  });

  it("defaults suggestions to empty array", () => {
    const result = jsonError("ERR", "Something broke");
    expect(result.error.suggestions).toEqual([]);
  });

  it("includes optional provider", () => {
    const result = jsonError("TIMEOUT", "Timed out", {
      provider: "hapoalim",
      retryable: true,
    });
    expect(result.error.provider).toBe("hapoalim");
    expect(result.error.retryable).toBe(true);
  });

  it("includes suggestions when provided", () => {
    const result = jsonError("AUTH_FAILED", "Bad creds", {
      suggestions: ["Check your password", "Run provider add again"],
    });
    expect(result.error.suggestions).toHaveLength(2);
    expect(result.error.suggestions[0]).toContain("password");
  });

  it("includes metadata with timestamp and version", () => {
    const result = jsonError("ERR", "test");
    expect(result.metadata).toBeDefined();
    expect(result.metadata.timestamp).toBeDefined();
    expect(result.metadata.version).toBeDefined();
  });
});
