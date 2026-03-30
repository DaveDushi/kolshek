// Zod schemas for custom page definitions.
// Validates the full widget tree before storing in DB.

import { z } from "zod";

// Supported icons (curated finance-relevant subset of lucide)
export const PAGE_ICONS = [
  "wallet", "banknote", "coins", "credit-card", "piggy-bank",
  "trending-up", "trending-down", "bar-chart-3", "pie-chart", "line-chart",
  "receipt", "shopping-cart", "shopping-bag", "store", "home",
  "car", "utensils", "coffee", "heart-pulse", "plane",
  "gift", "calendar", "clock", "target", "flag",
  "alert-triangle", "check-circle", "info", "zap", "scale",
  "building-2", "landmark", "calculator", "percent", "hash",
  "layers", "layout-dashboard", "file-text", "list", "grid-3x3",
  "arrow-left-right", "arrow-up-down", "repeat", "split", "merge",
] as const;

// Slug format: lowercase alphanumeric + hyphens, 2-50 chars
const pageIdSchema = z.string().regex(
  /^[a-z0-9][a-z0-9-]{0,48}[a-z0-9]$/,
  "Page ID must be a URL-safe slug (lowercase, hyphens, 2-50 chars)",
);

// Shared filter schema — used by query primitives
export const filtersSchema = z.object({
  period: z.string().optional(), // "month", "90d", "2026-01", "2026-01/2026-03"
  category: z.array(z.string()).optional(),
  merchant: z.array(z.string()).optional(),
  amountMin: z.number().optional(),
  amountMax: z.number().optional(),
  account: z.array(z.string()).optional(),
  direction: z.enum(["expense", "income", "all"]).optional(),
  type: z.enum(["normal", "installments", "all"]).optional(),
}).strict().optional();

// Query primitives
const aggregateQuerySchema = z.object({
  type: z.literal("aggregate"),
  groupBy: z.enum(["category", "merchant", "month", "week", "day", "account"]).nullable().optional(),
  metric: z.enum(["sum", "avg", "count", "min", "max"]).optional(),
  field: z.enum(["chargedAmount", "originalAmount"]).optional(),
  filters: filtersSchema,
  limit: z.number().int().min(1).max(500).optional(),
  sort: z.enum(["value_desc", "value_asc", "label_asc"]).optional(),
  compareTo: z.enum(["previous_period"]).nullable().optional(),
});

const trendQuerySchema = z.object({
  type: z.literal("trend"),
  interval: z.enum(["day", "week", "month"]).optional(),
  series: z.enum(["total", "category", "merchant"]).optional(),
  metric: z.enum(["sum", "avg", "count"]).optional(),
  filters: filtersSchema,
});

const transactionsQuerySchema = z.object({
  type: z.literal("transactions"),
  filters: filtersSchema,
  sort: z.enum(["date_desc", "date_asc", "amount_desc", "amount_asc"]).optional(),
  limit: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().min(0).optional(),
});

const balancesQuerySchema = z.object({
  type: z.literal("balances"),
  account: z.array(z.string()).optional(),
});

const budgetVsActualQuerySchema = z.object({
  type: z.literal("budget_vs_actual"),
  month: z.string().optional(),
  filters: filtersSchema,
});

export const querySchema = z.discriminatedUnion("type", [
  aggregateQuerySchema,
  trendQuerySchema,
  transactionsQuerySchema,
  balancesQuerySchema,
  budgetVsActualQuerySchema,
]);

export type WidgetQuery = z.infer<typeof querySchema>;

// Widget schemas (recursive via lazy)
const baseWidget = {
  title: z.string().optional(),
  className: z.string().optional(),
};

const metricCardSchema = z.object({
  ...baseWidget,
  type: z.literal("metric-card"),
  query: querySchema,
  format: z.enum(["currency", "number", "percent"]).optional(),
  label: z.string().optional(),
});

const chartSchema = z.object({
  ...baseWidget,
  type: z.literal("chart"),
  chartType: z.enum(["line", "bar", "area", "pie", "donut"]),
  query: querySchema,
  height: z.number().int().min(100).max(800).optional(),
});

const tableSchema = z.object({
  ...baseWidget,
  type: z.literal("table"),
  query: querySchema,
  columns: z.array(z.object({
    key: z.string(),
    label: z.string(),
    format: z.enum(["currency", "number", "percent", "date", "text"]).optional(),
  })).optional(),
});

const progressBarSchema = z.object({
  ...baseWidget,
  type: z.literal("progress-bar"),
  query: querySchema,
  target: z.number().optional(),
  format: z.enum(["currency", "number", "percent"]).optional(),
});

const comparisonSchema = z.object({
  ...baseWidget,
  type: z.literal("comparison"),
  queries: z.tuple([querySchema, querySchema]),
  labels: z.tuple([z.string(), z.string()]).optional(),
  format: z.enum(["currency", "number", "percent"]).optional(),
});

const alertSchema = z.object({
  ...baseWidget,
  type: z.literal("alert"),
  query: querySchema,
  threshold: z.number(),
  condition: z.enum(["above", "below"]),
  message: z.string(),
  severity: z.enum(["info", "warning", "error"]).optional(),
});

const textSchema = z.object({
  ...baseWidget,
  type: z.literal("text"),
  content: z.string(),
  size: z.enum(["sm", "base", "lg", "xl"]).optional(),
});

const filterBarSchema = z.object({
  ...baseWidget,
  type: z.literal("filter-bar"),
  filters: z.array(z.enum(["dateRange", "category", "merchant", "account", "direction"])),
});

// Layout widgets need forward reference via z.lazy()

const gridSchema: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    ...baseWidget,
    type: z.literal("grid"),
    columns: z.object({
      sm: z.number().int().min(1).max(12).optional(),
      md: z.number().int().min(1).max(12).optional(),
      lg: z.number().int().min(1).max(12).optional(),
    }).optional(),
    children: z.array(widgetSchema).min(1).max(50),
  }),
);

const stackSchema: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    ...baseWidget,
    type: z.literal("stack"),
    direction: z.enum(["vertical", "horizontal"]).optional(),
    gap: z.number().int().min(0).max(16).optional(),
    children: z.array(widgetSchema).min(1).max(50),
  }),
);

const tabsSchema: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    ...baseWidget,
    type: z.literal("tabs"),
    tabs: z.array(z.object({
      label: z.string(),
      value: z.string(),
      children: z.array(widgetSchema).min(1).max(50),
    })).min(1).max(10),
  }),
);

export const widgetSchema: z.ZodType<unknown> = z.lazy(() =>
  z.discriminatedUnion("type", [
    metricCardSchema,
    chartSchema,
    tableSchema,
    progressBarSchema,
    comparisonSchema,
    alertSchema,
    textSchema,
    filterBarSchema,
    gridSchema as any,
    stackSchema as any,
    tabsSchema as any,
  ]),
);

// Full page definition
export const pageDefinitionSchema = z.object({
  id: pageIdSchema,
  title: z.string().min(1).max(100),
  icon: z.string().default("file-text"),
  description: z.string().max(500).optional(),
  layout: widgetSchema,
});

export type PageDefinition = z.infer<typeof pageDefinitionSchema>;

// Validate a page definition, returns parsed result or throws
export function validatePageDefinition(input: unknown): PageDefinition {
  return pageDefinitionSchema.parse(input);
}

// Count total widgets in a definition (for DoS prevention)
export function countWidgets(widget: unknown): number {
  if (!widget || typeof widget !== "object") return 0;
  const w = widget as Record<string, unknown>;
  let count = 1;
  if (Array.isArray(w.children)) {
    for (const child of w.children) count += countWidgets(child);
  }
  if (Array.isArray(w.tabs)) {
    for (const tab of w.tabs as Array<Record<string, unknown>>) {
      if (Array.isArray(tab.children)) {
        for (const child of tab.children) count += countWidgets(child);
      }
    }
  }
  return count;
}

// Max nesting depth check
export function maxDepth(widget: unknown, depth: number = 0): number {
  if (!widget || typeof widget !== "object") return depth;
  const w = widget as Record<string, unknown>;
  let max = depth;
  if (Array.isArray(w.children)) {
    for (const child of w.children) {
      max = Math.max(max, maxDepth(child, depth + 1));
    }
  }
  if (Array.isArray(w.tabs)) {
    for (const tab of w.tabs as Array<Record<string, unknown>>) {
      if (Array.isArray(tab.children)) {
        for (const child of tab.children) {
          max = Math.max(max, maxDepth(child, depth + 1));
        }
      }
    }
  }
  return max;
}

const MAX_WIDGETS = 50;
const MAX_DEPTH = 5;

// Full validation with structural limits
export function validatePage(input: unknown): { success: true; data: PageDefinition } | { success: false; error: string } {
  try {
    const page = validatePageDefinition(input);
    const widgets = countWidgets(page.layout);
    if (widgets > MAX_WIDGETS) {
      return { success: false, error: `Too many widgets (${widgets}/${MAX_WIDGETS})` };
    }
    const depth = maxDepth(page.layout);
    if (depth > MAX_DEPTH) {
      return { success: false, error: `Nesting too deep (${depth}/${MAX_DEPTH})` };
    }
    return { success: true, data: page };
  } catch (err) {
    const msg = err instanceof z.ZodError
      ? err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ")
      : err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}
