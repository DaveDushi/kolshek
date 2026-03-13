import { describe, it, expect } from "vitest";
import { ruleConditionsSchema, formatZodErrors } from "../../src/cli/commands/categorize.js";

// ---------------------------------------------------------------------------
// Shorthand expansions
// ---------------------------------------------------------------------------

describe("amount shorthand", () => {
  it("accepts plain number as { exact: N }", () => {
    const result = ruleConditionsSchema.safeParse({ amount: -6500 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toEqual({ exact: -6500 });
    }
  });

  it("accepts object form as-is", () => {
    const result = ruleConditionsSchema.safeParse({ amount: { exact: -6500 } });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toEqual({ exact: -6500 });
    }
  });

  it("accepts amount range object", () => {
    const result = ruleConditionsSchema.safeParse({ amount: { min: -7000, max: -6000 } });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toEqual({ min: -7000, max: -6000 });
    }
  });

  it("rejects string for amount", () => {
    const result = ruleConditionsSchema.safeParse({ amount: "bad" });
    expect(result.success).toBe(false);
  });
});

describe("description shorthand", () => {
  it("accepts plain string as { pattern, mode: substring }", () => {
    const result = ruleConditionsSchema.safeParse({ description: "Check" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toEqual({ pattern: "Check", mode: "substring" });
    }
  });

  it("accepts object form with explicit mode", () => {
    const result = ruleConditionsSchema.safeParse({
      description: { pattern: "Check", mode: "exact" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toEqual({ pattern: "Check", mode: "exact" });
    }
  });

  it("defaults mode to substring when omitted", () => {
    const result = ruleConditionsSchema.safeParse({
      description: { pattern: "Check" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toEqual({ pattern: "Check", mode: "substring" });
    }
  });
});

describe("memo shorthand", () => {
  it("accepts plain string as { pattern, mode: substring }", () => {
    const result = ruleConditionsSchema.safeParse({ memo: "payment" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.memo).toEqual({ pattern: "payment", mode: "substring" });
    }
  });
});

// ---------------------------------------------------------------------------
// Issue #14 exact repro
// ---------------------------------------------------------------------------

describe("issue #14 repro payload", () => {
  it("accepts the exact payload from the bug report", () => {
    const payload = {
      description: { pattern: "Check", mode: "exact" },
      account: "leumi:948-85326_77",
      amount: -6500,
      direction: "debit",
    };
    const result = ruleConditionsSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toEqual({ exact: -6500 });
      expect(result.data.description).toEqual({ pattern: "Check", mode: "exact" });
      expect(result.data.account).toBe("leumi:948-85326_77");
      expect(result.data.direction).toBe("debit");
    }
  });
});

// ---------------------------------------------------------------------------
// Multi-field conditions
// ---------------------------------------------------------------------------

describe("multi-field conditions", () => {
  it("accepts all fields together", () => {
    const result = ruleConditionsSchema.safeParse({
      description: "Check",
      memo: "rent",
      account: "leumi:12345",
      amount: -6500,
      direction: "debit",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty conditions", () => {
    const result = ruleConditionsSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects unknown direction", () => {
    const result = ruleConditionsSchema.safeParse({ direction: "incoming" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// formatZodErrors
// ---------------------------------------------------------------------------

describe("formatZodErrors", () => {
  it("includes field path in output", () => {
    const result = ruleConditionsSchema.safeParse({ amount: "bad" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const formatted = formatZodErrors(result.error.issues);
      expect(formatted).toContain("amount");
    }
  });

  it("formats root-level errors", () => {
    const result = ruleConditionsSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const formatted = formatZodErrors(result.error.issues);
      expect(formatted).toContain("(root)");
      expect(formatted).toContain("At least one condition is required");
    }
  });
});
