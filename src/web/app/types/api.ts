// API response types — client-side copies of server types.
// These must NOT import bun:sqlite or any server-side modules.

export interface Provider {
  id: number;
  companyId: string;
  alias: string;
  displayName: string;
  type: "bank" | "credit-card";
  lastSyncedAt: string | null;
}

export interface ProviderCard extends Provider {
  hasCredentials: boolean;
  accountCount: number;
  transactionCount: number;
}

export interface Account {
  id: number;
  providerId: number;
  accountNumber: string;
  displayName: string;
  balance: number | null;
  currency: string;
}

export interface Transaction {
  id: number;
  accountId: number;
  type: "normal" | "installments";
  date: string;
  processedDate: string;
  originalAmount: number;
  originalCurrency: string;
  chargedAmount: number;
  chargedCurrency: string;
  description: string;
  descriptionEn: string | null;
  memo: string | null;
  category: string | null;
  status: "pending" | "completed";
  installmentNumber: number | null;
  installmentTotal: number | null;
}

export interface TransactionWithContext extends Transaction {
  providerDisplayName: string;
  providerType: string;
  companyId: string;
  accountNumber: string;
}

export interface TransactionFilters {
  from?: string;
  to?: string;
  provider?: string;
  account?: string;
  category?: string;
  status?: string;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CategorySummary {
  category: string;
  transactionCount: number;
  totalAmount: number;
}

export interface CategoryRule {
  id: number;
  category: string;
  conditions: RuleConditions;
  priority: number;
}

export interface RuleConditions {
  description?: { pattern: string; mode: "substring" | "exact" | "regex" };
  memo?: { pattern: string; mode: "substring" | "exact" | "regex" };
  account?: string;
  amount?: { value?: number; min?: number; max?: number };
  direction?: "debit" | "credit";
}

// Matches TranslationRule from src/db/repositories/translations.ts
export interface TranslationRule {
  id: number;
  englishName: string;
  matchPattern: string;
  createdAt: string;
}

export interface UntranslatedGroup {
  description: string;
  count: number;
  totalAmount: number;
}

export interface TranslatedGroup {
  description: string;
  descriptionEn: string;
  count: number;
  totalAmount: number;
}

// Matches BalanceRow from src/db/repositories/reports.ts
export interface BalanceRow {
  provider: string;
  providerAlias: string;
  providerType: string;
  accountNumber: string;
  balance: number | null;
  currency: string;
  lastSyncedAt: string | null;
  recentExpenses30d: number;
  recentIncome30d: number;
}

export interface MonthlyReport {
  month: string;
  income: number;
  expenses: number;
  net: number;
  transactionCount: number;
}

export interface SpendingItem {
  name: string;
  amount: number;
  count: number;
  percentage: number;
}

// Raw spending response from backend
export interface SpendingResult {
  groups: Array<{
    label: string;
    totalAmount: number;
    transactionCount: number;
    percentage: number;
  }>;
  summary: {
    totalExpenses: number;
    transactionCount: number;
    avgPerDay: number;
    daysInRange: number;
  };
}

// Matches IncomeResult from src/db/repositories/income.ts
export interface IncomeTransaction {
  date: string;
  description: string;
  descriptionEn: string | null;
  chargedAmount: number;
  category: string | null;
  provider: string;
  providerType: string;
  accountNumber: string;
  incomeType: string;
}

export interface IncomeSummary {
  totalIncome: number;
  salary: number;
  transfers: number;
  refunds: number;
  other: number;
  transactionCount: number;
}

export interface IncomeResult {
  transactions: IncomeTransaction[];
  summary: IncomeSummary;
}

// Matches TrendTotal from src/db/repositories/trends.ts (extends MonthlyRow)
export interface TrendTotal {
  month: string;
  income: number;
  expenses: number;
  net: number;
  transactionCount: number;
  expenseChange: number | null;
  incomeChange: number | null;
}

// Matches CategoryTrend from src/db/repositories/trends.ts
export interface CategoryTrend {
  month: string;
  totalAmount: number;
  transactionCount: number;
  change: number | null;
}

// Matches FixedVariableMonth from src/db/repositories/trends.ts
export interface FixedVariableMonth {
  month: string;
  fixed: number;
  variable: number;
  fixedPercent: number;
  fixedMerchants: number;
}

// Matches Insight from src/core/insights.ts
export interface Insight {
  type: string;
  severity: "alert" | "warning" | "info";
  title: string;
  detail: string;
  amount?: number;
}

export interface SyncEvent {
  type: "progress" | "result" | "error" | "done";
  provider?: string;
  stage?: string;
  message?: string;
  added?: number;
  updated?: number;
  error?: string;
}

export interface ProviderInfo {
  companyId: string;
  displayName: string;
  type: "bank" | "credit-card";
  loginFields: string[];
}

// Classification system
export type BuiltinClassification =
  | "expense"
  | "income"
  | "cc_billing"
  | "transfer"
  | "investment"
  | "debt"
  | "savings";

// Map of category name → classification
export type ClassificationMap = Record<string, string>;
