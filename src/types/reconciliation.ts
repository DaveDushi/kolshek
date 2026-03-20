// Reconciliation types for fuzzy duplicate detection and balance checking.

export interface FuzzyMatchConfig {
  amountTolerance: number;
  dateWindowDays: number;
  descriptionThreshold: number;
  crossAccount: boolean;
}

export const DEFAULT_FUZZY_CONFIG: FuzzyMatchConfig = {
  amountTolerance: 1.0,
  dateWindowDays: 3,
  descriptionThreshold: 0.6,
  crossAccount: false,
};

export interface DuplicateTxSummary {
  id: number;
  date: string;
  description: string;
  descriptionEn: string | null;
  chargedAmount: number;
  chargedCurrency: string | null;
  status: string;
  category: string | null;
  providerAlias: string;
  accountNumber: string;
}

export interface DuplicateCandidate {
  txA: DuplicateTxSummary;
  txB: DuplicateTxSummary;
  score: number;
  amountDiff: number;
  dateDiffDays: number;
  descriptionSimilarity: number;
  sameAccount: boolean;
}

export type ReconciliationDecision = "merged" | "dismissed";

export interface ReconciliationRecord {
  id: number;
  txIdA: number;
  txIdB: number;
  decision: ReconciliationDecision;
  score: number;
  mergedIntoTxId: number | null;
  decidedAt: string;
  notes: string | null;
}

export interface BalanceReconciliation {
  accountId: number;
  accountNumber: string;
  providerAlias: string;
  expectedBalance: number;
  computedBalance: number;
  discrepancy: number;
  transactionCount: number;
  dateRange: { from: string; to: string };
  currency: string;
}
