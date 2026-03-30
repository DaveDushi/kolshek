// Trends service — shared orchestration for CLI + web dashboard.

import {
  getTotalTrends as repoGetTotalTrends,
  getCategoryTrends as repoGetCategoryTrends,
  getFixedVariableTrends as repoGetFixedVariableTrends,
  type TrendTotal,
} from "../db/repositories/trends.js";
import { monthsAgoToFrom } from "../shared/date-utils.js";

export type { TrendTotal } from "../db/repositories/trends.js";

export interface GetTrendsOptions {
  months?: number;
  providerType?: string;
  excludeClassifications?: readonly string[];
}

export function getTotalTrendData(options?: GetTrendsOptions): TrendTotal[] {
  const from = monthsAgoToFrom(options?.months ?? 6);
  return repoGetTotalTrends(
    { from },
    options?.providerType,
    options?.excludeClassifications,
  );
}

export function getCategoryTrendData(
  category: string,
  options?: GetTrendsOptions,
) {
  const from = monthsAgoToFrom(options?.months ?? 6);
  return repoGetCategoryTrends(
    { from },
    category,
    options?.providerType,
    options?.excludeClassifications,
  );
}

export function getFixedVariableTrendData(options?: GetTrendsOptions) {
  const from = monthsAgoToFrom(options?.months ?? 6);
  return repoGetFixedVariableTrends(
    { from },
    options?.providerType,
    options?.excludeClassifications,
  );
}
