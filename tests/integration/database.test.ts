import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { initDatabase, closeDatabase } from "../../src/db/database.js";
import {
  createProvider,
  getProvider,
  getProviderByCompanyId,
  getProviderByAlias,
  getProvidersByCompanyId,
  resolveProviders,
  listProviders,
  deleteProvider,
  updateLastSynced,
} from "../../src/db/repositories/providers.js";
import { upsertAccount, getAccountsByProvider } from "../../src/db/repositories/accounts.js";
import {
  upsertTransaction,
  listTransactions,
  searchTransactions,
  countTransactions,
} from "../../src/db/repositories/transactions.js";
import {
  createSyncLog,
  completeSyncLog,
  getLastSuccessfulSync,
} from "../../src/db/repositories/sync-log.js";
import type { TransactionInput } from "../../src/types/index.js";

beforeAll(() => {
  initDatabase(":memory:");
});

afterAll(() => {
  closeDatabase();
});

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

describe("provider CRUD", () => {
  let providerId: number;

  it("creates a provider with default alias", () => {
    const provider = createProvider("hapoalim", "Bank Hapoalim", "bank");
    expect(provider.id).toBeDefined();
    expect(provider.companyId).toBe("hapoalim");
    expect(provider.alias).toBe("hapoalim");
    expect(provider.displayName).toBe("Bank Hapoalim");
    expect(provider.type).toBe("bank");
    expect(provider.lastSyncedAt).toBeNull();
    providerId = provider.id;
  });

  it("gets a provider by id", () => {
    const provider = getProvider(providerId);
    expect(provider).not.toBeNull();
    expect(provider!.companyId).toBe("hapoalim");
  });

  it("gets a provider by companyId", () => {
    const provider = getProviderByCompanyId("hapoalim");
    expect(provider).not.toBeNull();
    expect(provider!.id).toBe(providerId);
  });

  it("returns null for non-existent provider", () => {
    expect(getProvider(99999)).toBeNull();
    expect(getProviderByCompanyId("nonexistent")).toBeNull();
  });

  it("lists providers", () => {
    createProvider("max", "Max", "credit_card");
    const providers = listProviders();
    expect(providers.length).toBeGreaterThanOrEqual(2);
    const companyIds = providers.map((p) => p.companyId);
    expect(companyIds).toContain("hapoalim");
    expect(companyIds).toContain("max");
  });

  it("updates lastSyncedAt", () => {
    const ts = "2025-12-15T10:00:00.000Z";
    updateLastSynced(providerId, ts);
    const provider = getProvider(providerId);
    expect(provider!.lastSyncedAt).toBe(ts);
  });

  it("deletes a provider", () => {
    const tempProvider = createProvider("leumi", "Bank Leumi", "bank");
    expect(getProvider(tempProvider.id)).not.toBeNull();
    deleteProvider(tempProvider.id);
    expect(getProvider(tempProvider.id)).toBeNull();
  });

  it("creates a provider with custom alias", () => {
    const provider = createProvider("leumi", "Bank Leumi (Personal)", "bank", "leumi-personal");
    expect(provider.alias).toBe("leumi-personal");
    expect(provider.companyId).toBe("leumi");
  });

  it("creates multiple providers with same companyId but different aliases", () => {
    const joint = createProvider("leumi", "Bank Leumi (Joint)", "bank", "leumi-joint");
    expect(joint.alias).toBe("leumi-joint");

    const byCompanyId = getProvidersByCompanyId("leumi");
    expect(byCompanyId.length).toBe(2);
  });

  it("gets provider by alias", () => {
    const p = getProviderByAlias("leumi-personal");
    expect(p).not.toBeNull();
    expect(p!.companyId).toBe("leumi");
    expect(p!.alias).toBe("leumi-personal");
  });

  it("resolves by alias (single match)", () => {
    const resolved = resolveProviders("leumi-joint");
    expect(resolved.length).toBe(1);
    expect(resolved[0].alias).toBe("leumi-joint");
  });

  it("resolves by companyId (multiple matches)", () => {
    const resolved = resolveProviders("leumi");
    expect(resolved.length).toBe(2);
  });

  it("resolves by numeric ID", () => {
    const all = listProviders();
    const first = all[0];
    const resolved = resolveProviders(String(first.id));
    expect(resolved.length).toBe(1);
    expect(resolved[0].id).toBe(first.id);
  });
});

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

describe("account upsert", () => {
  let providerId: number;

  beforeAll(() => {
    const p = getProviderByCompanyId("hapoalim");
    providerId = p!.id;
  });

  it("creates a new account", () => {
    const account = upsertAccount(providerId, "12-345-678901", "hapoalim", 23450.75);
    expect(account.id).toBeDefined();
    expect(account.providerId).toBe(providerId);
    expect(account.accountNumber).toBe("12-345-678901");
    expect(account.balance).toBe(23450.75);
    expect(account.currency).toBe("ILS");
  });

  it("updates existing account balance on conflict", () => {
    const updated = upsertAccount(providerId, "12-345-678901", "hapoalim", 30000.0);
    expect(updated.accountNumber).toBe("12-345-678901");
    expect(updated.balance).toBe(30000.0);
  });

  it("creates a second account under the same provider", () => {
    const savings = upsertAccount(providerId, "12-345-900001", "hapoalim", 56012.35);
    expect(savings.accountNumber).toBe("12-345-900001");

    const accounts = getAccountsByProvider(providerId);
    expect(accounts.length).toBe(2);
  });

  it("reuses account when another provider has same company_id and account_number", () => {
    // Create a second max provider (simulates two Max logins)
    const max2 = createProvider("max", "Max 2", "credit_card", "max-2");
    const maxProvider = getProviderByCompanyId("max")!;

    // First provider creates the account
    const first = upsertAccount(maxProvider.id, "5544", "max", 1000);
    // Second provider discovers the same card
    const second = upsertAccount(max2.id, "5544", "max", 2000);

    // Should reuse the same account row, not create a duplicate
    expect(second.id).toBe(first.id);
    // Balance updated to the latest value
    expect(second.balance).toBe(2000);
  });

  it("creates separate accounts for different company_ids", () => {
    const hapoalim = getProviderByCompanyId("hapoalim")!;
    const max = getProviderByCompanyId("max")!;

    const bankAcct = upsertAccount(hapoalim.id, "9999", "hapoalim", 5000);
    const ccAcct = upsertAccount(max.id, "9999", "max", 3000);

    // Same account_number but different companies — must be separate
    expect(ccAcct.id).not.toBe(bankAcct.id);
  });
});

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

describe("transaction upsert", () => {
  let accountId: number;

  beforeAll(() => {
    const accounts = getAccountsByProvider(
      getProviderByCompanyId("hapoalim")!.id,
    );
    accountId = accounts[0].id;
  });

  function makeTxInput(overrides?: Partial<TransactionInput>): TransactionInput {
    return {
      accountId,
      type: "normal",
      identifier: "TXN-001",
      date: "2025-12-01T00:00:00.000Z",
      processedDate: "2025-12-02T00:00:00.000Z",
      originalAmount: -249.9,
      originalCurrency: "ILS",
      chargedAmount: -249.9,
      description: "Shufersal Deal",
      memo: "Branch 42",
      status: "completed",
      hash: "test_hash_001",
      uniqueId: "test_uid_001",
      ...overrides,
    };
  }

  it("inserts a new transaction", () => {
    const result = upsertTransaction(makeTxInput());
    expect(result.action).toBe("inserted");
  });

  it("returns unchanged for duplicate with same status", () => {
    const result = upsertTransaction(makeTxInput());
    expect(result.action).toBe("unchanged");
  });

  it("updates status from pending to completed", () => {
    const pendingTx = makeTxInput({
      hash: "test_hash_pending",
      uniqueId: "test_uid_pending",
      status: "pending",
      description: "Wolt",
    });
    upsertTransaction(pendingTx);

    const updated = upsertTransaction({
      ...pendingTx,
      status: "completed",
    });
    expect(updated.action).toBe("updated");
  });

  it("inserts multiple transactions with different hashes", () => {
    const tx2 = makeTxInput({
      hash: "test_hash_002",
      uniqueId: "test_uid_002",
      description: "Rami Levy",
      chargedAmount: -89.0,
      originalAmount: -89.0,
    });
    const tx3 = makeTxInput({
      hash: "test_hash_003",
      uniqueId: "test_uid_003",
      description: "HOT Mobile",
      chargedAmount: -350,
      originalAmount: -350,
      type: "installments",
      installmentNumber: 3,
      installmentTotal: 12,
    });

    expect(upsertTransaction(tx2).action).toBe("inserted");
    expect(upsertTransaction(tx3).action).toBe("inserted");
  });
});

// ---------------------------------------------------------------------------
// Transaction queries
// ---------------------------------------------------------------------------

describe("listTransactions with filters", () => {
  // Seed additional data for query tests
  beforeAll(() => {
    const maxProvider = getProviderByCompanyId("max");
    if (!maxProvider) return;
    const maxAccount = upsertAccount(maxProvider.id, "4580-XXXX-XXXX-9012", "max");

    const txns: Partial<TransactionInput>[] = [
      {
        accountId: maxAccount.id,
        hash: "max_hash_001",
        uniqueId: "max_uid_001",
        description: "Castro",
        chargedAmount: -129.9,
        originalAmount: -129.9,
        date: "2025-12-02T00:00:00.000Z",
        processedDate: "2025-12-10T00:00:00.000Z",
        status: "completed",
      },
      {
        accountId: maxAccount.id,
        hash: "max_hash_002",
        uniqueId: "max_uid_002",
        description: "Netflix",
        chargedAmount: -35.0,
        originalAmount: -9.99,
        originalCurrency: "USD",
        date: "2025-12-05T00:00:00.000Z",
        processedDate: "2025-12-10T00:00:00.000Z",
        status: "completed",
      },
      {
        accountId: maxAccount.id,
        hash: "max_hash_003",
        uniqueId: "max_uid_003",
        description: "Aroma TLV",
        chargedAmount: -67.0,
        originalAmount: -67.0,
        date: "2025-12-06T00:00:00.000Z",
        processedDate: "2025-12-10T00:00:00.000Z",
        status: "pending",
      },
    ];

    for (const partial of txns) {
      upsertTransaction({
        type: "normal",
        identifier: null,
        originalCurrency: "ILS",
        memo: null,
        hash: "",
        uniqueId: "",
        date: "",
        processedDate: "",
        originalAmount: 0,
        chargedAmount: 0,
        description: "",
        status: "completed",
        accountId: maxAccount.id,
        ...partial,
      });
    }
  });

  it("lists all transactions without filters", () => {
    const txns = listTransactions({});
    expect(txns.length).toBeGreaterThanOrEqual(5);
  });

  it("filters by date range", () => {
    const txns = listTransactions({
      from: "2025-12-04T00:00:00.000Z",
      to: "2025-12-06T00:00:00.000Z",
    });
    for (const tx of txns) {
      expect(tx.date >= "2025-12-04").toBe(true);
      expect(tx.date <= "2025-12-07").toBe(true);
    }
  });

  it("filters by provider companyId", () => {
    const txns = listTransactions({ providerCompanyId: "max" });
    for (const tx of txns) {
      expect(tx.providerCompanyId).toBe("max");
    }
    expect(txns.length).toBeGreaterThanOrEqual(1);
  });

  it("filters by amount range", () => {
    const txns = listTransactions({
      minAmount: -100,
      maxAmount: -30,
    });
    for (const tx of txns) {
      expect(tx.chargedAmount).toBeGreaterThanOrEqual(-100);
      expect(tx.chargedAmount).toBeLessThanOrEqual(-30);
    }
  });

  it("filters by status", () => {
    const pending = listTransactions({ status: "pending" });
    for (const tx of pending) {
      expect(tx.status).toBe("pending");
    }
  });

  it("sorts by amount ascending", () => {
    const txns = listTransactions({ sort: "amount", sortDirection: "asc" });
    for (let i = 1; i < txns.length; i++) {
      expect(txns[i].chargedAmount).toBeGreaterThanOrEqual(txns[i - 1].chargedAmount);
    }
  });

  it("respects limit", () => {
    const txns = listTransactions({ limit: 2 });
    expect(txns.length).toBe(2);
  });
});

describe("searchTransactions", () => {
  it("finds transactions matching query", () => {
    const results = searchTransactions("Shufersal");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].description).toContain("Shufersal");
  });

  it("returns empty array for non-matching query", () => {
    const results = searchTransactions("XYZNONEXISTENT123");
    expect(results).toEqual([]);
  });

  it("search is case-insensitive via LIKE", () => {
    const upper = searchTransactions("CASTRO");
    const lower = searchTransactions("castro");
    // SQLite LIKE is case-insensitive for ASCII
    expect(upper.length).toBe(lower.length);
  });
});

describe("countTransactions", () => {
  it("counts all transactions", () => {
    const count = countTransactions();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  it("counts with filters", () => {
    const total = countTransactions();
    const pending = countTransactions({ status: "pending" });
    expect(pending).toBeLessThan(total);
    expect(pending).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Sync log
// ---------------------------------------------------------------------------

describe("sync log", () => {
  let providerId: number;

  beforeAll(() => {
    providerId = getProviderByCompanyId("hapoalim")!.id;
  });

  it("creates a running sync log entry", () => {
    const log = createSyncLog(providerId, "2025-11-01");
    expect(log.id).toBeDefined();
    expect(log.providerId).toBe(providerId);
    expect(log.status).toBe("running");
    expect(log.scrapeStartDate).toBe("2025-11-01");
    expect(log.completedAt).toBeNull();
  });

  it("completes a sync log as success", () => {
    const log = createSyncLog(providerId, "2025-12-01");
    completeSyncLog(log.id, "success", 10, 2);

    const last = getLastSuccessfulSync(providerId);
    expect(last).not.toBeNull();
    expect(last!.status).toBe("success");
    expect(last!.transactionsAdded).toBe(10);
    expect(last!.transactionsUpdated).toBe(2);
    expect(last!.completedAt).not.toBeNull();
    expect(last!.errorMessage).toBeNull();
  });

  it("completes a sync log as error", () => {
    const log = createSyncLog(providerId, "2025-12-10");
    completeSyncLog(log.id, "error", 0, 0, "Connection timeout");

    // The last *successful* sync should still be the previous one
    const last = getLastSuccessfulSync(providerId);
    expect(last).not.toBeNull();
    expect(last!.scrapeStartDate).toBe("2025-12-01");
  });

  it("returns null when no successful sync exists for provider", () => {
    const maxProvider = getProviderByCompanyId("max");
    const last = getLastSuccessfulSync(maxProvider!.id);
    expect(last).toBeNull();
  });
});
