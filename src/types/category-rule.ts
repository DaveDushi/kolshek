// Category rule types for the multi-field rule engine.

export type MatchMode = "substring" | "exact" | "regex";

export interface TextMatch {
  pattern: string;
  mode: MatchMode;
}

export interface AmountMatch {
  exact?: number;
  min?: number;
  max?: number;
}

// All present fields are AND'd together. At least one condition required.
export interface RuleConditions {
  description?: TextMatch;
  memo?: TextMatch;
  account?: string; // "providerAlias:accountNumber" or just "accountNumber"
  amount?: AmountMatch;
  direction?: "debit" | "credit";
}

export interface CategoryRule {
  id: number;
  category: string;
  conditions: RuleConditions;
  priority: number;
  createdAt: string;
}

export interface CategoryRuleInput {
  category: string;
  conditions: RuleConditions;
  priority?: number;
}

// Minimal transaction shape needed for rule evaluation (keeps core/ pure).
export interface TransactionForMatching {
  id: number;
  description: string;
  descriptionEn: string | null;
  memo: string | null;
  chargedAmount: number;
  providerAlias: string;
  accountNumber: string;
}
