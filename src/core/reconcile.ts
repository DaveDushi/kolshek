// Pure reconciliation logic — fuzzy matching and scoring.
// No DB or CLI imports. Operates on plain types only.

import { parseISO, differenceInCalendarDays } from "date-fns";
import type { DuplicateTxSummary, DuplicateCandidate, FuzzyMatchConfig } from "../types/index.js";

// ---------------------------------------------------------------------------
// String similarity (normalized Levenshtein)
// ---------------------------------------------------------------------------

export function stringSimilarity(a: string, b: string): number {
  const la = a.toLowerCase();
  const lb = b.toLowerCase();

  if (la === lb) return 1;
  if (la.length === 0 || lb.length === 0) return 0;

  const maxLen = Math.max(la.length, lb.length);
  const dist = levenshtein(la, lb);
  return 1 - dist / maxLen;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  // Use single-row optimization
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);

  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,       // deletion
        curr[j - 1] + 1,   // insertion
        prev[j - 1] + cost, // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}

// ---------------------------------------------------------------------------
// Fuzzy score computation
// ---------------------------------------------------------------------------

// Scoring weights
const W_AMOUNT = 0.4;
const W_DATE = 0.3;
const W_DESC = 0.2;
const W_ACCOUNT = 0.1;

export function computeFuzzyScore(
  txA: DuplicateTxSummary,
  txB: DuplicateTxSummary,
  config: FuzzyMatchConfig,
): DuplicateCandidate | null {
  // Amount check
  const amountDiff = Math.abs(txA.chargedAmount - txB.chargedAmount);
  if (amountDiff > config.amountTolerance) return null;

  // Date check
  const dateA = parseISO(txA.date);
  const dateB = parseISO(txB.date);
  const dateDiffDays = Math.abs(differenceInCalendarDays(dateA, dateB));
  if (dateDiffDays > config.dateWindowDays) return null;

  // Description similarity
  const descriptionSimilarity = stringSimilarity(txA.description, txB.description);
  if (descriptionSimilarity < config.descriptionThreshold) return null;

  // Same account check
  const sameAccount = txA.accountNumber === txB.accountNumber && txA.providerAlias === txB.providerAlias;

  // Score components
  const amountScore = config.amountTolerance > 0
    ? 1 - amountDiff / config.amountTolerance
    : amountDiff === 0 ? 1 : 0;
  const dateScore = config.dateWindowDays > 0
    ? 1 - dateDiffDays / config.dateWindowDays
    : dateDiffDays === 0 ? 1 : 0;
  const accountScore = sameAccount ? 1.0 : 0.5;

  const score =
    W_AMOUNT * amountScore +
    W_DATE * dateScore +
    W_DESC * descriptionSimilarity +
    W_ACCOUNT * accountScore;

  return {
    txA,
    txB,
    score,
    amountDiff,
    dateDiffDays,
    descriptionSimilarity,
    sameAccount,
  };
}

// ---------------------------------------------------------------------------
// Rank and filter candidates
// ---------------------------------------------------------------------------

export function rankDuplicates(
  candidates: DuplicateCandidate[],
  minScore = 0.5,
): DuplicateCandidate[] {
  return candidates
    .filter((c) => c.score >= minScore)
    .sort((a, b) => b.score - a.score);
}
