// Insights service — shared orchestration for CLI + web dashboard.

import { subMonths } from "date-fns";
import {
  getCategoryByMonth,
  getLargeTransactions,
  getMerchantHistory,
  getMonthCashflow,
} from "../db/repositories/insights.js";
import {
  detectCategorySpikes,
  detectLargeTransactions,
  detectNewMerchants,
  detectRecurringChanges,
  detectTrendWarnings,
  type Insight,
} from "../core/insights.js";

export type { Insight } from "../core/insights.js";

export interface GetInsightsOptions {
  months?: number;
  excludeClassifications?: readonly string[];
}

export interface InsightsResult {
  insights: Insight[];
  period: { from: string; months: number };
  summary: {
    total: number;
    alerts: number;
    warnings: number;
    info: number;
  };
}

export function getInsights(options?: GetInsightsOptions): InsightsResult {
  const months = options?.months ?? 3;
  const now = new Date();
  const from = subMonths(now, months).toISOString().slice(0, 10);
  const currentMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const insightOpts = {
    from,
    currentMonthStart,
    excludeClassifications: options?.excludeClassifications,
  };

  // Gather raw data from repositories
  const categoryData = getCategoryByMonth(insightOpts);
  const currentMonthKey = currentMonthStart.slice(0, 7);
  const currentCategories = categoryData.filter((c) => c.month >= currentMonthKey);
  const priorCategories = categoryData.filter((c) => c.month < currentMonthKey);

  const { transactions: largeTxns, avgAmount } = getLargeTransactions(insightOpts);
  const merchantHistory = getMerchantHistory(insightOpts);
  const cashflow = getMonthCashflow(insightOpts);

  // Run all detectors
  const insights: Insight[] = [
    ...detectCategorySpikes(currentCategories, priorCategories),
    ...detectLargeTransactions(largeTxns, avgAmount),
    ...detectNewMerchants(merchantHistory),
    ...detectRecurringChanges(merchantHistory),
    ...detectTrendWarnings(cashflow),
  ];

  // Sort by severity
  const order = { alert: 0, warning: 1, info: 2 };
  insights.sort((a, b) => order[a.severity] - order[b.severity]);

  return {
    insights,
    period: { from, months },
    summary: {
      total: insights.length,
      alerts: insights.filter((i) => i.severity === "alert").length,
      warnings: insights.filter((i) => i.severity === "warning").length,
      info: insights.filter((i) => i.severity === "info").length,
    },
  };
}
