// Pure sync helpers — deduplication, mapping, concurrency.
// Orchestration (DB calls, scraping) lives in services/sync.ts.

import { formatISO, parseISO } from "date-fns";
import { roundToNearestMinutes } from "date-fns";
import type {
  TransactionStatus,
  TransactionType,
} from "../types/index.js";

// ---------------------------------------------------------------------------
// Deduplication helpers
// ---------------------------------------------------------------------------

export function transactionHash(
  tx: {
    date: string;
    chargedAmount: number;
    description: string;
    memo?: string | null;
  },
  companyId: string,
  accountNumber: string,
): string {
  const date = roundToNearestMinutes(parseISO(tx.date)).toISOString();
  return [
    date,
    tx.chargedAmount,
    tx.description,
    tx.memo,
    companyId,
    accountNumber,
  ]
    .map((p) => String(p ?? ""))
    .join("_");
}

export function transactionUniqueId(
  tx: {
    date: string;
    chargedAmount: number;
    description: string;
    memo?: string | null;
    identifier?: string | number | null;
  },
  companyId: string,
  accountNumber: string,
): string {
  const date = formatISO(parseISO(tx.date), { representation: "date" });
  return [
    date,
    companyId,
    accountNumber,
    tx.chargedAmount,
    tx.identifier || `${tx.description}_${tx.memo}`,
  ]
    .map((p) => String(p ?? "").trim())
    .join("_");
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

export function mapTransactionType(type?: string): TransactionType {
  if (type === "installments") return "installments";
  return "normal";
}

export function mapTransactionStatus(status?: string): TransactionStatus {
  if (status === "pending") return "pending";
  return "completed";
}

// ---------------------------------------------------------------------------
// Concurrency utility
// ---------------------------------------------------------------------------

export async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
  signal?: AbortSignal,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  const executing: Set<Promise<void>> = new Set();

  for (let i = 0; i < items.length; i++) {
    // Skip remaining items if cancelled
    if (signal?.aborted) break;

    const index = i;
    const p = fn(items[index]).then((result) => {
      results[index] = result;
    });

    const tracked = p.then(
      () => {
        executing.delete(tracked);
      },
      () => {
        executing.delete(tracked);
      },
    );
    executing.add(tracked);

    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
}
