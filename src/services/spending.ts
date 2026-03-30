// Spending service — shared orchestration for CLI + web dashboard.

import {
  getSpendingReport,
  type SpendingResult,
  type SpendingGroupBy,
} from "../db/repositories/spending.js";
import { monthToDateRange } from "../shared/date-utils.js";

export type { SpendingResult, SpendingGroupBy } from "../db/repositories/spending.js";

export interface GetSpendingOptions {
  // Provide either month (YYYY-MM) or explicit from/to range
  month?: string;
  from?: string;
  to?: string;
  groupBy?: SpendingGroupBy;
  category?: string;
  providerType?: string;
  top?: number;
  excludeClassifications?: readonly string[];
}

export function getSpending(options?: GetSpendingOptions): SpendingResult {
  let from: string;
  let to: string;

  if (options?.from && options?.to) {
    from = options.from;
    to = options.to;
  } else {
    const month = options?.month ?? new Date().toISOString().slice(0, 7);
    const range = monthToDateRange(month);
    from = range.from;
    to = range.to;
  }

  return getSpendingReport({
    from,
    to,
    groupBy: options?.groupBy ?? "category",
    category: options?.category,
    providerType: options?.providerType,
    top: options?.top,
    excludeClassifications: options?.excludeClassifications,
  });
}
