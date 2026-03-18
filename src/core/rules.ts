// Pure rule evaluation engine. No DB or CLI imports.

import type {
  RuleConditions,
  TextMatch,
  AmountMatch,
  CategoryRule,
  TransactionForMatching,
} from "../types/index.js";

// ---------------------------------------------------------------------------
// Individual matchers
// ---------------------------------------------------------------------------

function matchesText(
  condition: TextMatch,
  ...values: (string | null)[]
): boolean {
  for (const value of values) {
    if (value == null) continue;
    switch (condition.mode) {
      case "exact":
        if (value === condition.pattern) return true;
        break;
      case "regex":
        try {
          // Guard against ReDoS: reject patterns > 200 chars or with nested quantifiers
          if (condition.pattern.length > 200) break;
          if (/(\+|\*|\{)\)?(\+|\*|\{)/.test(condition.pattern)) break;
          if (new RegExp(condition.pattern, "i").test(value)) return true;
        } catch {
          // invalid regex — treat as non-match
        }
        break;
      case "substring":
      default: {
        const lower = value.toLowerCase();
        const pat = condition.pattern.toLowerCase();
        if (lower.includes(pat)) return true;
        break;
      }
    }
  }
  return false;
}

function matchesAccount(condition: string, providerAlias: string, accountNumber: string): boolean {
  // "alias:accountNumber" format
  if (condition.includes(":")) {
    const sepIdx = condition.indexOf(":");
    const alias = condition.slice(0, sepIdx);
    const accNum = condition.slice(sepIdx + 1);
    return providerAlias === alias && accountNumber === accNum;
  }
  // plain account number
  return accountNumber === condition;
}

function matchesAmount(condition: AmountMatch, chargedAmount: number): boolean {
  if (condition.exact !== undefined && chargedAmount !== condition.exact) return false;
  if (condition.min !== undefined && chargedAmount < condition.min) return false;
  if (condition.max !== undefined && chargedAmount > condition.max) return false;
  return true;
}

function matchesDirection(direction: "debit" | "credit", chargedAmount: number): boolean {
  if (direction === "debit") return chargedAmount < 0;
  return chargedAmount > 0;
}

// ---------------------------------------------------------------------------
// Rule evaluation
// ---------------------------------------------------------------------------

// Evaluate a single rule against a transaction. All present conditions AND'd.
export function evaluateRule(
  conditions: RuleConditions,
  tx: TransactionForMatching,
): boolean {
  if (conditions.description) {
    if (!matchesText(conditions.description, tx.description, tx.descriptionEn)) return false;
  }
  if (conditions.memo) {
    if (!matchesText(conditions.memo, tx.memo)) return false;
  }
  if (conditions.account) {
    if (!matchesAccount(conditions.account, tx.providerAlias, tx.accountNumber)) return false;
  }
  if (conditions.amount) {
    if (!matchesAmount(conditions.amount, tx.chargedAmount)) return false;
  }
  if (conditions.direction) {
    if (!matchesDirection(conditions.direction, tx.chargedAmount)) return false;
  }
  return true;
}

// Apply rules to transactions. Returns Map<transactionId, category>.
// Rules must already be sorted by priority DESC, id ASC. First match wins.
export function applyRules(
  rules: CategoryRule[],
  transactions: TransactionForMatching[],
): Map<number, string> {
  const result = new Map<number, string>();
  for (const tx of transactions) {
    for (const rule of rules) {
      if (evaluateRule(rule.conditions, tx)) {
        result.set(tx.id, rule.category);
        break;
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Human-readable conditions formatter
// ---------------------------------------------------------------------------

function formatTextMatch(prefix: string, m: TextMatch): string {
  switch (m.mode) {
    case "exact":
      return `${prefix}="${m.pattern}"`;
    case "regex":
      return `${prefix}/${m.pattern}/`;
    case "substring":
    default:
      return `${prefix}~"${m.pattern}"`;
  }
}

export function formatConditions(conditions: RuleConditions): string {
  const parts: string[] = [];

  if (conditions.description) {
    parts.push(formatTextMatch("desc", conditions.description));
  }
  if (conditions.memo) {
    parts.push(formatTextMatch("memo", conditions.memo));
  }
  if (conditions.account) {
    parts.push(`account:${conditions.account}`);
  }
  if (conditions.amount) {
    const a = conditions.amount;
    if (a.exact !== undefined) {
      parts.push(`amount:${a.exact}`);
    } else if (a.min !== undefined && a.max !== undefined) {
      parts.push(`amount:${a.min}..${a.max}`);
    } else if (a.min !== undefined) {
      parts.push(`amount>=${a.min}`);
    } else if (a.max !== undefined) {
      parts.push(`amount<=${a.max}`);
    }
  }
  if (conditions.direction) {
    parts.push(`dir:${conditions.direction}`);
  }

  return parts.join(" AND ");
}
