import { describe, it, expect } from "vitest";
import {
  transactionHash,
  transactionUniqueId,
} from "../../src/core/sync-engine.js";

describe("transactionHash", () => {
  const baseTx = {
    date: "2025-12-01T10:30:00.000Z",
    chargedAmount: -249.9,
    description: "Shufersal Deal",
    memo: "Branch 42",
  };

  it("produces the same hash for identical inputs", () => {
    const h1 = transactionHash(baseTx, "hapoalim", "12345");
    const h2 = transactionHash({ ...baseTx }, "hapoalim", "12345");
    expect(h1).toBe(h2);
  });

  it("produces different hashes when description differs", () => {
    const h1 = transactionHash(baseTx, "hapoalim", "12345");
    const h2 = transactionHash(
      { ...baseTx, description: "Rami Levy" },
      "hapoalim",
      "12345",
    );
    expect(h1).not.toBe(h2);
  });

  it("produces different hashes when amount differs", () => {
    const h1 = transactionHash(baseTx, "hapoalim", "12345");
    const h2 = transactionHash(
      { ...baseTx, chargedAmount: -100 },
      "hapoalim",
      "12345",
    );
    expect(h1).not.toBe(h2);
  });

  it("produces different hashes when companyId differs", () => {
    const h1 = transactionHash(baseTx, "hapoalim", "12345");
    const h2 = transactionHash(baseTx, "leumi", "12345");
    expect(h1).not.toBe(h2);
  });

  it("produces different hashes when accountNumber differs", () => {
    const h1 = transactionHash(baseTx, "hapoalim", "12345");
    const h2 = transactionHash(baseTx, "hapoalim", "67890");
    expect(h1).not.toBe(h2);
  });

  it("handles null memo consistently", () => {
    const txNullMemo = { ...baseTx, memo: null };
    const h1 = transactionHash(txNullMemo, "hapoalim", "12345");
    const h2 = transactionHash(txNullMemo, "hapoalim", "12345");
    expect(h1).toBe(h2);
  });

  it("distinguishes null memo from string memo", () => {
    const txNullMemo = { ...baseTx, memo: null };
    const txWithMemo = { ...baseTx, memo: "something" };
    const h1 = transactionHash(txNullMemo, "hapoalim", "12345");
    const h2 = transactionHash(txWithMemo, "hapoalim", "12345");
    expect(h1).not.toBe(h2);
  });

  it("handles undefined memo the same as null", () => {
    const txUndefined = { ...baseTx, memo: undefined };
    const txNull = { ...baseTx, memo: null };
    const h1 = transactionHash(txUndefined, "hapoalim", "12345");
    const h2 = transactionHash(txNull, "hapoalim", "12345");
    expect(h1).toBe(h2);
  });

  it("produces different hashes when date differs", () => {
    const h1 = transactionHash(baseTx, "hapoalim", "12345");
    const h2 = transactionHash(
      { ...baseTx, date: "2025-12-02T10:30:00.000Z" },
      "hapoalim",
      "12345",
    );
    expect(h1).not.toBe(h2);
  });
});

describe("transactionUniqueId", () => {
  const baseTx = {
    date: "2025-12-01T10:30:00.000Z",
    chargedAmount: -249.9,
    description: "Shufersal Deal",
    memo: "Branch 42",
    identifier: "TXN-001",
  };

  it("produces the same uniqueId for identical inputs", () => {
    const id1 = transactionUniqueId(baseTx, "hapoalim", "12345");
    const id2 = transactionUniqueId({ ...baseTx }, "hapoalim", "12345");
    expect(id1).toBe(id2);
  });

  it("is stable across calls with same inputs", () => {
    const results = Array.from({ length: 10 }, () =>
      transactionUniqueId(baseTx, "hapoalim", "12345"),
    );
    expect(new Set(results).size).toBe(1);
  });

  it("uses identifier when present", () => {
    const id1 = transactionUniqueId(baseTx, "hapoalim", "12345");
    const id2 = transactionUniqueId(
      { ...baseTx, identifier: "TXN-002" },
      "hapoalim",
      "12345",
    );
    expect(id1).not.toBe(id2);
  });

  it("falls back to description_memo when identifier is null", () => {
    const txNoId = { ...baseTx, identifier: null };
    const id = transactionUniqueId(txNoId, "hapoalim", "12345");
    expect(id).toContain("Shufersal Deal_Branch 42");
  });

  it("falls back to description_memo when identifier is undefined", () => {
    const txNoId = {
      date: baseTx.date,
      chargedAmount: baseTx.chargedAmount,
      description: baseTx.description,
      memo: baseTx.memo,
    };
    const id = transactionUniqueId(txNoId, "hapoalim", "12345");
    expect(id).toContain("Shufersal Deal_Branch 42");
  });

  it("produces different uniqueIds for same amount but different description", () => {
    const tx1 = { ...baseTx, identifier: null as string | null };
    const tx2 = { ...tx1, description: "Rami Levy" };
    const id1 = transactionUniqueId(tx1, "hapoalim", "12345");
    const id2 = transactionUniqueId(tx2, "hapoalim", "12345");
    expect(id1).not.toBe(id2);
  });

  it("includes date (date-only) in the uniqueId", () => {
    const id = transactionUniqueId(baseTx, "hapoalim", "12345");
    expect(id).toContain("2025-12-01");
  });

  it("produces different uniqueIds when companyId differs", () => {
    const id1 = transactionUniqueId(baseTx, "hapoalim", "12345");
    const id2 = transactionUniqueId(baseTx, "leumi", "12345");
    expect(id1).not.toBe(id2);
  });

  it("produces different uniqueIds when accountNumber differs", () => {
    const id1 = transactionUniqueId(baseTx, "hapoalim", "12345");
    const id2 = transactionUniqueId(baseTx, "hapoalim", "99999");
    expect(id1).not.toBe(id2);
  });

  it("handles missing memo in fallback gracefully", () => {
    const txNoMemo = { ...baseTx, identifier: null as string | null, memo: null };
    const id = transactionUniqueId(txNoMemo, "hapoalim", "12345");
    expect(id).toBeDefined();
    expect(id.length).toBeGreaterThan(0);
  });
});
