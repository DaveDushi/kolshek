import { describe, it, expect } from "vitest";
import { evaluateRule, applyRules, formatConditions } from "../../src/core/rules.js";
import type {
  RuleConditions,
  CategoryRule,
  TransactionForMatching,
} from "../../src/types/index.js";

// Helper to build a minimal transaction for matching
function makeTx(overrides: Partial<TransactionForMatching> = {}): TransactionForMatching {
  return {
    id: 1,
    description: "שופרסל דיל",
    descriptionEn: "Shufersal Deal",
    memo: null,
    chargedAmount: -150.0,
    providerAlias: "leumi",
    accountNumber: "12345",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Description matching
// ---------------------------------------------------------------------------

describe("description matching", () => {
  it("substring match (Hebrew)", () => {
    const cond: RuleConditions = { description: { pattern: "שופרסל", mode: "substring" } };
    expect(evaluateRule(cond, makeTx())).toBe(true);
  });

  it("substring match (English, case-insensitive)", () => {
    const cond: RuleConditions = { description: { pattern: "shufersal", mode: "substring" } };
    expect(evaluateRule(cond, makeTx())).toBe(true);
  });

  it("substring match against description_en", () => {
    const cond: RuleConditions = { description: { pattern: "Deal", mode: "substring" } };
    expect(evaluateRule(cond, makeTx())).toBe(true);
  });

  it("substring no match", () => {
    const cond: RuleConditions = { description: { pattern: "רמי לוי", mode: "substring" } };
    expect(evaluateRule(cond, makeTx())).toBe(false);
  });

  it("exact match", () => {
    const cond: RuleConditions = { description: { pattern: "שופרסל דיל", mode: "exact" } };
    expect(evaluateRule(cond, makeTx())).toBe(true);
  });

  it("exact match fails on partial", () => {
    const cond: RuleConditions = { description: { pattern: "שופרסל", mode: "exact" } };
    expect(evaluateRule(cond, makeTx())).toBe(false);
  });

  it("regex match", () => {
    const cond: RuleConditions = { description: { pattern: "שופרסל.*דיל", mode: "regex" } };
    expect(evaluateRule(cond, makeTx())).toBe(true);
  });

  it("regex match is case-insensitive", () => {
    const cond: RuleConditions = { description: { pattern: "SHUFERSAL", mode: "regex" } };
    expect(evaluateRule(cond, makeTx())).toBe(true);
  });

  it("invalid regex treated as non-match (no throw)", () => {
    const cond: RuleConditions = { description: { pattern: "[invalid", mode: "regex" } };
    expect(evaluateRule(cond, makeTx())).toBe(false);
  });

  it("matches description_en when description does not match", () => {
    const cond: RuleConditions = { description: { pattern: "Shufersal Deal", mode: "exact" } };
    expect(evaluateRule(cond, makeTx())).toBe(true);
  });

  it("null description_en is skipped, matches description", () => {
    const tx = makeTx({ descriptionEn: null });
    const cond: RuleConditions = { description: { pattern: "שופרסל", mode: "substring" } };
    expect(evaluateRule(cond, tx)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Memo matching
// ---------------------------------------------------------------------------

describe("memo matching", () => {
  it("substring match on memo", () => {
    const cond: RuleConditions = { memo: { pattern: "branch", mode: "substring" } };
    const tx = makeTx({ memo: "Branch 42" });
    expect(evaluateRule(cond, tx)).toBe(true);
  });

  it("null memo returns false", () => {
    const cond: RuleConditions = { memo: { pattern: "branch", mode: "substring" } };
    expect(evaluateRule(cond, makeTx({ memo: null }))).toBe(false);
  });

  it("regex on memo", () => {
    const cond: RuleConditions = { memo: { pattern: "branch \\d+", mode: "regex" } };
    const tx = makeTx({ memo: "Branch 42" });
    expect(evaluateRule(cond, tx)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Account matching
// ---------------------------------------------------------------------------

describe("account matching", () => {
  it("matches alias:accountNumber", () => {
    const cond: RuleConditions = { account: "leumi:12345" };
    expect(evaluateRule(cond, makeTx())).toBe(true);
  });

  it("fails on wrong alias", () => {
    const cond: RuleConditions = { account: "hapoalim:12345" };
    expect(evaluateRule(cond, makeTx())).toBe(false);
  });

  it("fails on wrong account number", () => {
    const cond: RuleConditions = { account: "leumi:99999" };
    expect(evaluateRule(cond, makeTx())).toBe(false);
  });

  it("matches plain account number (no alias)", () => {
    const cond: RuleConditions = { account: "12345" };
    expect(evaluateRule(cond, makeTx())).toBe(true);
  });

  it("plain account number fails on mismatch", () => {
    const cond: RuleConditions = { account: "99999" };
    expect(evaluateRule(cond, makeTx())).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Amount matching
// ---------------------------------------------------------------------------

describe("amount matching", () => {
  it("exact amount match", () => {
    const cond: RuleConditions = { amount: { exact: -150 } };
    expect(evaluateRule(cond, makeTx())).toBe(true);
  });

  it("exact amount mismatch", () => {
    const cond: RuleConditions = { amount: { exact: -100 } };
    expect(evaluateRule(cond, makeTx())).toBe(false);
  });

  it("min amount (inclusive)", () => {
    const cond: RuleConditions = { amount: { min: -200 } };
    expect(evaluateRule(cond, makeTx({ chargedAmount: -150 }))).toBe(true);
  });

  it("min amount excludes lower", () => {
    const cond: RuleConditions = { amount: { min: -100 } };
    expect(evaluateRule(cond, makeTx({ chargedAmount: -150 }))).toBe(false);
  });

  it("max amount (inclusive)", () => {
    const cond: RuleConditions = { amount: { max: -100 } };
    expect(evaluateRule(cond, makeTx({ chargedAmount: -150 }))).toBe(true);
  });

  it("max amount excludes higher", () => {
    const cond: RuleConditions = { amount: { max: -200 } };
    expect(evaluateRule(cond, makeTx({ chargedAmount: -150 }))).toBe(false);
  });

  it("range match (min and max)", () => {
    const cond: RuleConditions = { amount: { min: -200, max: -100 } };
    expect(evaluateRule(cond, makeTx({ chargedAmount: -150 }))).toBe(true);
  });

  it("range excludes outside", () => {
    const cond: RuleConditions = { amount: { min: -200, max: -100 } };
    expect(evaluateRule(cond, makeTx({ chargedAmount: -50 }))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Direction matching
// ---------------------------------------------------------------------------

describe("direction matching", () => {
  it("debit matches negative amount", () => {
    const cond: RuleConditions = { direction: "debit" };
    expect(evaluateRule(cond, makeTx({ chargedAmount: -100 }))).toBe(true);
  });

  it("debit fails on positive", () => {
    const cond: RuleConditions = { direction: "debit" };
    expect(evaluateRule(cond, makeTx({ chargedAmount: 100 }))).toBe(false);
  });

  it("credit matches positive amount", () => {
    const cond: RuleConditions = { direction: "credit" };
    expect(evaluateRule(cond, makeTx({ chargedAmount: 500 }))).toBe(true);
  });

  it("credit fails on negative", () => {
    const cond: RuleConditions = { direction: "credit" };
    expect(evaluateRule(cond, makeTx({ chargedAmount: -500 }))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AND logic (multiple conditions)
// ---------------------------------------------------------------------------

describe("AND logic", () => {
  it("all conditions must match", () => {
    const cond: RuleConditions = {
      description: { pattern: "שופרסל", mode: "substring" },
      direction: "debit",
      account: "leumi:12345",
    };
    expect(evaluateRule(cond, makeTx())).toBe(true);
  });

  it("fails if any condition fails", () => {
    const cond: RuleConditions = {
      description: { pattern: "שופרסל", mode: "substring" },
      direction: "credit", // mismatch: tx is debit
    };
    expect(evaluateRule(cond, makeTx())).toBe(false);
  });

  it("complex multi-field rule", () => {
    const cond: RuleConditions = {
      description: { pattern: "Check", mode: "exact" },
      account: "leumi:948-85326_77",
      amount: { exact: -6500 },
      direction: "debit",
    };
    const tx = makeTx({
      description: "Check",
      descriptionEn: null,
      chargedAmount: -6500,
      providerAlias: "leumi",
      accountNumber: "948-85326_77",
    });
    expect(evaluateRule(cond, tx)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// applyRules — priority and first-match-wins
// ---------------------------------------------------------------------------

describe("applyRules", () => {
  const txs: TransactionForMatching[] = [
    makeTx({ id: 1, description: "שופרסל דיל", chargedAmount: -150 }),
    makeTx({ id: 2, description: "Netflix", descriptionEn: "Netflix", chargedAmount: -49.9 }),
    makeTx({ id: 3, description: "salary", descriptionEn: "Salary", chargedAmount: 15000 }),
  ];

  it("first matching rule wins (by priority DESC, then id ASC)", () => {
    const rules: CategoryRule[] = [
      { id: 2, category: "Entertainment", conditions: { description: { pattern: "Netflix", mode: "substring" } }, priority: 10, createdAt: "" },
      { id: 1, category: "Groceries", conditions: { description: { pattern: "שופרסל", mode: "substring" } }, priority: 5, createdAt: "" },
      { id: 3, category: "Income", conditions: { direction: "credit" }, priority: 0, createdAt: "" },
    ];

    const result = applyRules(rules, txs);
    expect(result.get(1)).toBe("Groceries");
    expect(result.get(2)).toBe("Entertainment");
    expect(result.get(3)).toBe("Income");
  });

  it("unmatched transactions are not in the map", () => {
    const rules: CategoryRule[] = [
      { id: 1, category: "Groceries", conditions: { description: { pattern: "שופרסל", mode: "substring" } }, priority: 0, createdAt: "" },
    ];

    const result = applyRules(rules, txs);
    expect(result.has(1)).toBe(true);
    expect(result.has(2)).toBe(false);
    expect(result.has(3)).toBe(false);
  });

  it("higher priority rule wins even with higher id", () => {
    const rules: CategoryRule[] = [
      { id: 10, category: "Specific Grocery", conditions: { description: { pattern: "שופרסל", mode: "substring" }, amount: { exact: -150 } }, priority: 10, createdAt: "" },
      { id: 1, category: "General Grocery", conditions: { description: { pattern: "שופרסל", mode: "substring" } }, priority: 0, createdAt: "" },
    ];

    const result = applyRules(rules, [txs[0]]);
    expect(result.get(1)).toBe("Specific Grocery");
  });
});

// ---------------------------------------------------------------------------
// formatConditions
// ---------------------------------------------------------------------------

describe("formatConditions", () => {
  it("substring description", () => {
    expect(formatConditions({ description: { pattern: "שופרסל", mode: "substring" } }))
      .toBe('desc~"שופרסל"');
  });

  it("exact description", () => {
    expect(formatConditions({ description: { pattern: "Netflix", mode: "exact" } }))
      .toBe('desc="Netflix"');
  });

  it("regex description", () => {
    expect(formatConditions({ description: { pattern: "net.*flix", mode: "regex" } }))
      .toBe("desc/net.*flix/");
  });

  it("multiple conditions joined with AND", () => {
    const cond: RuleConditions = {
      description: { pattern: "Check", mode: "exact" },
      account: "leumi:12345",
      direction: "debit",
    };
    expect(formatConditions(cond)).toBe('desc="Check" AND account:leumi:12345 AND dir:debit');
  });

  it("amount range", () => {
    expect(formatConditions({ amount: { min: -200, max: -100 } }))
      .toBe("amount:-200..-100");
  });

  it("amount exact", () => {
    expect(formatConditions({ amount: { exact: -6500 } }))
      .toBe("amount:-6500");
  });

  it("amount min only", () => {
    expect(formatConditions({ amount: { min: -500 } }))
      .toBe("amount>=-500");
  });

  it("amount max only", () => {
    expect(formatConditions({ amount: { max: -100 } }))
      .toBe("amount<=-100");
  });

  it("memo condition", () => {
    expect(formatConditions({ memo: { pattern: "branch", mode: "substring" } }))
      .toBe('memo~"branch"');
  });
});
