// Income service — shared orchestration for CLI + web dashboard.

import {
  getIncomeReport,
  type IncomeResult,
} from "../db/repositories/income.js";
import { monthToDateRange } from "../shared/date-utils.js";

export type { IncomeResult } from "../db/repositories/income.js";

export interface GetIncomeOptions {
  // Provide either month (YYYY-MM) or explicit from/to range
  month?: string;
  from?: string;
  to?: string;
  salaryOnly?: boolean;
  includeRefunds?: boolean;
  excludeClassifications?: readonly string[];
}

export function getIncome(options?: GetIncomeOptions): IncomeResult {
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

  return getIncomeReport({
    from,
    to,
    salaryOnly: options?.salaryOnly,
    includeRefunds: options?.includeRefunds,
    excludeClassifications: options?.excludeClassifications,
  });
}
