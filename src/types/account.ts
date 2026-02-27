/**
 * Account = a specific account under a provider.
 * A bank may have checking + savings, a CC company has card accounts.
 */

export interface Account {
  id: number;
  providerId: number;
  accountNumber: string;
  displayName: string | null;
  balance: number | null;
  currency: string;
  createdAt: string;
}

export interface AccountCreateInput {
  providerId: number;
  accountNumber: string;
  displayName?: string;
  balance?: number;
  currency?: string;
}
