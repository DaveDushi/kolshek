---
name: custom-page
description: >
  Create custom dashboard pages — compose widgets (charts, metrics, tables,
  progress bars) with composable query primitives to build any financial view.
  Use when: custom dashboard, create page, build view, budget tracker,
  spending analysis, merchant breakdown, savings tracker, custom report,
  financial dashboard, add page, new view, budget view, envelope budgeting.
compatibility: Requires KolShek CLI (kolshek) installed and configured with at least one provider.
metadata:
  author: kolshek
  version: "0.3.6"
allowed-tools: Bash Read Write AskUserQuestion
---

# /kolshek:custom-page

You are creating a custom dashboard page for KolShek. Pages are JSON definitions that compose pre-built widgets with composable query primitives. The dashboard renders them at runtime — no build step needed.

## Workflow

1. **Ask the user** what they want to see (spending analysis, budget tracker, merchant deep-dive, etc.)
2. **Generate** the page JSON definition
3. **Save** to a temp file and run `kolshek page create --file <path> --json`
4. **Verify** the page was created and tell the user to check their dashboard

## Page Definition Format

```json
{
  "id": "my-page-slug",
  "title": "Page Title",
  "icon": "wallet",
  "description": "Optional description shown in the header",
  "layout": { /* root widget — usually a stack or grid */ }
}
```

- `id`: URL-safe slug (lowercase, hyphens, 2-50 chars). Example: `monthly-budget`, `merchant-analysis`
- `icon`: One of the supported icons (see list below)
- `layout`: The root widget definition (recursive tree)

## Widget Types

### Data Widgets (fetch from DB)

**metric-card** — Single number with optional comparison
```json
{
  "type": "metric-card",
  "title": "Total Spending",
  "query": { "type": "aggregate", "metric": "sum", "filters": { "direction": "expense", "period": "month" } },
  "format": "currency",
  "label": "This Month"
}
```
- `format`: "currency" | "number" | "percent"
- `label`: Optional subtitle text

**chart** — Line, bar, area, pie, or donut chart
```json
{
  "type": "chart",
  "title": "Daily Spending",
  "chartType": "bar",
  "query": { "type": "trend", "interval": "day", "filters": { "direction": "expense", "period": "month" } },
  "height": 300
}
```
- `chartType`: "line" | "bar" | "area" | "pie" | "donut"
- For pie/donut, use `aggregate` query with `groupBy`
- For line/bar/area, use `trend` query

**table** — Sortable data table
```json
{
  "type": "table",
  "title": "Recent Large Transactions",
  "query": { "type": "transactions", "filters": { "amountMin": 500, "period": "month" }, "sort": "amount_desc", "limit": 10 },
  "columns": [
    { "key": "date", "label": "Date", "format": "date" },
    { "key": "description", "label": "Description" },
    { "key": "chargedAmount", "label": "Amount", "format": "currency" },
    { "key": "category", "label": "Category" }
  ]
}
```

**progress-bar** — Goal/budget tracking
```json
{
  "type": "progress-bar",
  "title": "Groceries Budget",
  "query": { "type": "aggregate", "metric": "sum", "filters": { "direction": "expense", "category": ["Groceries"], "period": "month" } },
  "target": 2000,
  "format": "currency"
}
```
- `target`: The target value (green <75%, amber 75-100%, red >100%)

**comparison** — Side-by-side metrics with delta
```json
{
  "type": "comparison",
  "title": "Month vs Last Month",
  "queries": [
    { "type": "aggregate", "metric": "sum", "filters": { "direction": "expense", "period": "month" } },
    { "type": "aggregate", "metric": "sum", "filters": { "direction": "expense", "period": "30d" } }
  ],
  "labels": ["This Month", "Last 30 Days"],
  "format": "currency"
}
```

**alert** — Conditional notification
```json
{
  "type": "alert",
  "query": { "type": "aggregate", "metric": "sum", "filters": { "direction": "expense", "period": "month" } },
  "threshold": 5000,
  "condition": "above",
  "message": "Monthly spending exceeded target",
  "severity": "warning"
}
```

### Layout Widgets (compose other widgets)

**stack** — Vertical or horizontal flex layout
```json
{
  "type": "stack",
  "direction": "vertical",
  "gap": 4,
  "children": [ /* widgets */ ]
}
```

**grid** — Responsive CSS grid
```json
{
  "type": "grid",
  "columns": { "sm": 1, "md": 2, "lg": 4 },
  "children": [ /* widgets */ ]
}
```

**tabs** — Tabbed container
```json
{
  "type": "tabs",
  "tabs": [
    { "label": "By Category", "value": "category", "children": [ /* widgets */ ] },
    { "label": "By Merchant", "value": "merchant", "children": [ /* widgets */ ] }
  ]
}
```

### Other Widgets

**filter-bar** — Page-level filters (affects all widgets)
```json
{
  "type": "filter-bar",
  "filters": ["dateRange", "category", "direction"]
}
```

**text** — Static text block
```json
{
  "type": "text",
  "content": "Track your monthly spending targets below.",
  "size": "base"
}
```

## Query Primitives

All data widgets use one of 5 query primitives. The key insight: they are deeply parameterized — vary the params to express any view.

### Shared Filters (used by aggregate, trend, transactions)
```json
{
  "period": "month",          // "month", "90d", "2026-01", "2026-01/2026-03"
  "category": ["Groceries"],  // filter to specific categories
  "merchant": ["shufersal*"], // glob patterns
  "amountMin": 100,           // minimum amount (absolute)
  "amountMax": 5000,          // maximum amount (absolute)
  "account": ["12345"],       // specific accounts
  "direction": "expense",     // "expense" | "income" | "all"
  "type": "normal"            // "normal" | "installments" | "all"
}
```

### aggregate — Numbers and breakdowns
```json
{
  "type": "aggregate",
  "groupBy": "category",       // null | "category" | "merchant" | "month" | "week" | "day" | "account"
  "metric": "sum",             // "sum" | "avg" | "count" | "min" | "max"
  "field": "chargedAmount",    // "chargedAmount" | "originalAmount"
  "filters": { ... },
  "limit": 10,                 // max groups
  "sort": "value_desc",        // "value_desc" | "value_asc" | "label_asc"
  "compareTo": "previous_period"  // null | "previous_period"
}
```
Returns: `{ value, groups[]?, comparison? }`

**What aggregate covers:**
- Total spending → `{ metric: "sum", filters: { direction: "expense" } }`
- By category → `{ groupBy: "category", metric: "sum" }`
- Top merchants → `{ groupBy: "merchant", limit: 10, sort: "value_desc" }`
- Average transaction → `{ metric: "avg" }`
- Month vs last month → `{ compareTo: "previous_period" }`

### trend — Time series for charts
```json
{
  "type": "trend",
  "interval": "day",     // "day" | "week" | "month"
  "series": "total",     // "total" | "category" | "merchant"
  "metric": "sum",       // "sum" | "avg" | "count"
  "filters": { ... }
}
```
Returns: `{ points: [{ date, value, breakdown? }] }`

### transactions — Filtered lists
```json
{
  "type": "transactions",
  "filters": { ... },
  "sort": "date_desc",   // "date_desc" | "date_asc" | "amount_desc" | "amount_asc"
  "limit": 20,
  "offset": 0
}
```
Returns: `{ rows: [{ id, date, description, descriptionEn, category, chargedAmount, provider, account }], total }`

### balances — Account balances
```json
{
  "type": "balances",
  "account": ["12345"]   // optional filter
}
```

### budget_vs_actual — Budget comparison
```json
{
  "type": "budget_vs_actual",
  "month": "2026-03"     // defaults to current month
}
```
Requires budget targets to be set via `kolshek` (future: budget management commands).

## Available Icons

wallet, banknote, coins, credit-card, piggy-bank, trending-up, trending-down,
bar-chart-3, pie-chart, line-chart, receipt, shopping-cart, shopping-bag, store,
home, car, utensils, coffee, heart-pulse, plane, gift, calendar, clock, target,
flag, alert-triangle, check-circle, info, zap, scale, building-2, landmark,
calculator, percent, hash, layers, layout-dashboard, file-text, list, grid-3x3,
arrow-left-right, arrow-up-down, repeat, split, merge

## Limits

- Max 50 widgets per page
- Max 5 nesting levels
- Max 500 rows from any query
- Max 20 queries per batch

## Example: Monthly Spending Dashboard

```json
{
  "id": "spending-overview",
  "title": "Spending Overview",
  "icon": "pie-chart",
  "description": "Monthly spending breakdown with category analysis",
  "layout": {
    "type": "stack",
    "direction": "vertical",
    "gap": 4,
    "children": [
      {
        "type": "filter-bar",
        "filters": ["dateRange", "direction"]
      },
      {
        "type": "grid",
        "columns": { "sm": 1, "md": 2, "lg": 4 },
        "children": [
          {
            "type": "metric-card",
            "title": "Total Spending",
            "query": { "type": "aggregate", "metric": "sum", "filters": { "direction": "expense", "period": "month" }, "compareTo": "previous_period" },
            "format": "currency"
          },
          {
            "type": "metric-card",
            "title": "Transaction Count",
            "query": { "type": "aggregate", "metric": "count", "filters": { "direction": "expense", "period": "month" } },
            "format": "number"
          },
          {
            "type": "metric-card",
            "title": "Avg Transaction",
            "query": { "type": "aggregate", "metric": "avg", "filters": { "direction": "expense", "period": "month" } },
            "format": "currency"
          },
          {
            "type": "metric-card",
            "title": "Largest Transaction",
            "query": { "type": "aggregate", "metric": "max", "filters": { "direction": "expense", "period": "month" } },
            "format": "currency"
          }
        ]
      },
      {
        "type": "grid",
        "columns": { "sm": 1, "md": 2 },
        "children": [
          {
            "type": "chart",
            "title": "Spending by Category",
            "chartType": "donut",
            "query": { "type": "aggregate", "groupBy": "category", "metric": "sum", "filters": { "direction": "expense", "period": "month" } }
          },
          {
            "type": "chart",
            "title": "Daily Spending Trend",
            "chartType": "bar",
            "query": { "type": "trend", "interval": "day", "filters": { "direction": "expense", "period": "month" } }
          }
        ]
      },
      {
        "type": "table",
        "title": "Top 10 Merchants",
        "query": { "type": "aggregate", "groupBy": "merchant", "metric": "sum", "filters": { "direction": "expense", "period": "month" }, "limit": 10 },
        "columns": [
          { "key": "label", "label": "Merchant" },
          { "key": "value", "label": "Amount", "format": "currency" },
          { "key": "count", "label": "Transactions", "format": "number" },
          { "key": "percentage", "label": "Share", "format": "percent" }
        ]
      }
    ]
  }
}
```

## Example: Envelope Budget Tracker

```json
{
  "id": "envelope-budget",
  "title": "Envelope Budget",
  "icon": "wallet",
  "description": "Track spending against category budgets",
  "layout": {
    "type": "stack",
    "direction": "vertical",
    "gap": 4,
    "children": [
      {
        "type": "text",
        "content": "Monthly envelope budget — each category has a spending limit.",
        "size": "sm"
      },
      {
        "type": "grid",
        "columns": { "sm": 1, "md": 2, "lg": 3 },
        "children": [
          {
            "type": "progress-bar",
            "title": "Groceries",
            "query": { "type": "aggregate", "metric": "sum", "filters": { "direction": "expense", "category": ["Groceries"], "period": "month" } },
            "target": 2000,
            "format": "currency"
          },
          {
            "type": "progress-bar",
            "title": "Dining Out",
            "query": { "type": "aggregate", "metric": "sum", "filters": { "direction": "expense", "category": ["Restaurants"], "period": "month" } },
            "target": 800,
            "format": "currency"
          },
          {
            "type": "progress-bar",
            "title": "Transportation",
            "query": { "type": "aggregate", "metric": "sum", "filters": { "direction": "expense", "category": ["Transportation"], "period": "month" } },
            "target": 500,
            "format": "currency"
          }
        ]
      },
      {
        "type": "chart",
        "title": "Monthly Spending Trend",
        "chartType": "area",
        "query": { "type": "trend", "interval": "month", "series": "category", "filters": { "direction": "expense", "period": "180d" } }
      }
    ]
  }
}
```

## How to Create

1. Write the page JSON to a temp file
2. Run: `kolshek page create --file /tmp/my-page.json --json`
3. Check the result — if success, tell the user to check their dashboard
4. If the dashboard is running, the page appears immediately (live reload via SSE)

## Tips

- Start with a `stack` as the root layout — it arranges children vertically
- Use `grid` for side-by-side cards (metrics, charts)
- Add a `filter-bar` at the top so users can change the time period
- Use `compareTo: "previous_period"` on metric cards to show trends
- For budget pages, ask the user their target amounts per category
- Category names must match exactly what's in the DB — run `kolshek query "SELECT DISTINCT category FROM transactions WHERE category IS NOT NULL ORDER BY category" --json` to get the list
- Keep pages focused — one theme per page (spending, income, merchant analysis)
