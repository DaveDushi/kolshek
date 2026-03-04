/**
 * Transaction types — maps closely to israeli-bank-scrapers Transaction.
 */

export type TransactionType = "normal" | "installments";
export type TransactionStatus = "completed" | "pending";

/** Stored transaction record from the database */
export interface Transaction {
  id: number;
  accountId: number;
  type: TransactionType;
  identifier: string | null;
  date: string;
  processedDate: string;
  originalAmount: number;
  originalCurrency: string;
  chargedAmount: number;
  chargedCurrency: string | null;
  description: string;
  descriptionEn: string | null;
  memo: string | null;
  status: TransactionStatus;
  installmentNumber: number | null;
  installmentTotal: number | null;
  category: string | null;
  hash: string;
  uniqueId: string;
  createdAt: string;
  updatedAt: string;
}

/** Input for creating/upserting a transaction */
export interface TransactionInput {
  accountId: number;
  type: TransactionType;
  identifier?: string | null;
  date: string;
  processedDate: string;
  originalAmount: number;
  originalCurrency: string;
  chargedAmount: number;
  chargedCurrency?: string | null;
  description: string;
  descriptionEn?: string | null;
  memo?: string | null;
  status: TransactionStatus;
  installmentNumber?: number | null;
  installmentTotal?: number | null;
  category?: string | null;
  hash: string;
  uniqueId: string;
}

/** Extended transaction with provider/account info for display */
export interface TransactionWithContext extends Transaction {
  providerDisplayName: string;
  providerCompanyId: string;
  accountNumber: string;
}

/** Filters for querying transactions */
export interface TransactionFilters {
  from?: string;
  to?: string;
  providerId?: number;
  providerCompanyId?: string;
  providerType?: "bank" | "credit_card";
  accountId?: number;
  accountNumber?: string;
  minAmount?: number;
  maxAmount?: number;
  status?: TransactionStatus;
  description?: string;
  sort?: "date" | "amount";
  sortDirection?: "asc" | "desc";
  limit?: number;
  offset?: number;
}
