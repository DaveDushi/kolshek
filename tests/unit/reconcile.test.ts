import { describe, it, expect } from "vitest";
import {
  stringSimilarity,
  computeFuzzyScore,
  rankDuplicates,
} from "../../src/core/reconcile.js";
import type { DuplicateTxSummary, FuzzyMatchConfig, DuplicateCandidate } from "../../src/types/index.js";

// ---------------------------------------------------------------------------
// stringSimilarity
// ---------------------------------------------------------------------------

describe("stringSimilarity", () => {
  it("returns 1 for identical strings", () => {
    expect(stringSimilarity("hello", "hello")).toBe(1);
  });

  it("returns 1 for case-different identical strings", () => {
    expect(stringSimilarity("Hello", "HELLO")).toBe(1);
  });

  it("returns 0 when one string is empty", () => {
    expect(stringSimilarity("hello", "")).toBe(0);
    expect(stringSimilarity("", "hello")).toBe(0);
  });

  it("returns 1 for both empty strings (identical match)", () => {
    expect(stringSimilarity("", "")).toBe(1);
  });

  it("returns high similarity for similar strings", () => {
    const sim = stringSimilarity("Shufersal", "Shufersl");
    expect(sim).toBeGreaterThan(0.7);
  });

  it("returns low similarity for very different strings", () => {
    const sim = stringSimilarity("Shufersal", "McDonald's");
    expect(sim).toBeLessThan(0.5);
  });

  it("handles Hebrew strings", () => {
    const sim = stringSimilarity("שופרסל", "שופרסל דיל");
    expect(sim).toBeGreaterThan(0.5);
  });
});

// ---------------------------------------------------------------------------
// computeFuzzyScore
// ---------------------------------------------------------------------------

const defaultConfig: FuzzyMatchConfig = {
  amountTolerance: 1.0,
  dateWindowDays: 3,
  descriptionThreshold: 0.6,
  crossAccount: false,
};

function makeTx(overrides: Partial<DuplicateTxSummary> = {}): DuplicateTxSummary {
  return {
    id: 1,
    date: "2025-01-15",
    description: "Shufersal",
    descriptionEn: null,
    chargedAmount: -120.5,
    chargedCurrency: "ILS",
    status: "completed",
    category: null,
    providerAlias: "Hapoalim",
    accountNumber: "12345",
    ...overrides,
  };
}

describe("computeFuzzyScore", () => {
  it("returns high score for identical transactions", () => {
    const txA = makeTx({ id: 1 });
    const txB = makeTx({ id: 2 });
    const result = computeFuzzyScore(txA, txB, defaultConfig);
    expect(result).not.toBeNull();
    expect(result!.score).toBeGreaterThan(0.9);
    expect(result!.sameAccount).toBe(true);
    expect(result!.amountDiff).toBe(0);
    expect(result!.dateDiffDays).toBe(0);
  });

  it("returns null when amount difference exceeds tolerance", () => {
    const txA = makeTx({ id: 1 });
    const txB = makeTx({ id: 2, chargedAmount: -125 });
    const result = computeFuzzyScore(txA, txB, defaultConfig);
    expect(result).toBeNull();
  });

  it("returns null when date difference exceeds window", () => {
    const txA = makeTx({ id: 1, date: "2025-01-15" });
    const txB = makeTx({ id: 2, date: "2025-01-25" });
    const result = computeFuzzyScore(txA, txB, defaultConfig);
    expect(result).toBeNull();
  });

  it("returns null when description similarity is below threshold", () => {
    const txA = makeTx({ id: 1, description: "Shufersal" });
    const txB = makeTx({ id: 2, description: "McDonald's" });
    const result = computeFuzzyScore(txA, txB, defaultConfig);
    expect(result).toBeNull();
  });

  it("gives lower score for different accounts", () => {
    const txA = makeTx({ id: 1 });
    const txB = makeTx({ id: 2, accountNumber: "99999" });
    const sameAccResult = computeFuzzyScore(txA, makeTx({ id: 3 }), defaultConfig);
    const diffAccResult = computeFuzzyScore(txA, txB, defaultConfig);
    expect(sameAccResult).not.toBeNull();
    expect(diffAccResult).not.toBeNull();
    expect(sameAccResult!.score).toBeGreaterThan(diffAccResult!.score);
  });

  it("handles transactions a few days apart", () => {
    const txA = makeTx({ id: 1, date: "2025-01-15" });
    const txB = makeTx({ id: 2, date: "2025-01-17" });
    const result = computeFuzzyScore(txA, txB, defaultConfig);
    expect(result).not.toBeNull();
    expect(result!.dateDiffDays).toBe(2);
    expect(result!.score).toBeGreaterThan(0.5);
    expect(result!.score).toBeLessThan(1.0);
  });

  it("handles small amount differences within tolerance", () => {
    const txA = makeTx({ id: 1, chargedAmount: -120.5 });
    const txB = makeTx({ id: 2, chargedAmount: -121.0 });
    const result = computeFuzzyScore(txA, txB, defaultConfig);
    expect(result).not.toBeNull();
    expect(result!.amountDiff).toBeCloseTo(0.5);
  });
});

// ---------------------------------------------------------------------------
// rankDuplicates
// ---------------------------------------------------------------------------

describe("rankDuplicates", () => {
  it("sorts candidates by score descending", () => {
    const candidates: DuplicateCandidate[] = [
      { txA: makeTx({ id: 1 }), txB: makeTx({ id: 2 }), score: 0.6, amountDiff: 0, dateDiffDays: 1, descriptionSimilarity: 0.8, sameAccount: true },
      { txA: makeTx({ id: 3 }), txB: makeTx({ id: 4 }), score: 0.9, amountDiff: 0, dateDiffDays: 0, descriptionSimilarity: 1, sameAccount: true },
      { txA: makeTx({ id: 5 }), txB: makeTx({ id: 6 }), score: 0.75, amountDiff: 0.5, dateDiffDays: 1, descriptionSimilarity: 0.9, sameAccount: true },
    ];

    const ranked = rankDuplicates(candidates);
    expect(ranked).toHaveLength(3);
    expect(ranked[0].score).toBe(0.9);
    expect(ranked[1].score).toBe(0.75);
    expect(ranked[2].score).toBe(0.6);
  });

  it("filters candidates below minScore", () => {
    const candidates: DuplicateCandidate[] = [
      { txA: makeTx({ id: 1 }), txB: makeTx({ id: 2 }), score: 0.3, amountDiff: 0, dateDiffDays: 2, descriptionSimilarity: 0.6, sameAccount: true },
      { txA: makeTx({ id: 3 }), txB: makeTx({ id: 4 }), score: 0.8, amountDiff: 0, dateDiffDays: 0, descriptionSimilarity: 1, sameAccount: true },
    ];

    const ranked = rankDuplicates(candidates, 0.5);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].score).toBe(0.8);
  });

  it("returns empty array when all below minScore", () => {
    const candidates: DuplicateCandidate[] = [
      { txA: makeTx({ id: 1 }), txB: makeTx({ id: 2 }), score: 0.3, amountDiff: 0, dateDiffDays: 2, descriptionSimilarity: 0.6, sameAccount: true },
    ];

    const ranked = rankDuplicates(candidates, 0.5);
    expect(ranked).toHaveLength(0);
  });

  it("returns empty array for empty input", () => {
    const ranked = rankDuplicates([]);
    expect(ranked).toHaveLength(0);
  });
});
