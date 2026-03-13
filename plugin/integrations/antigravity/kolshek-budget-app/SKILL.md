---
name: kolshek-budget-app
description: Design and build a personal budget dashboard powered by your KolShek transaction data.
risk: low
source: community
date_added: '2026-03-13'
---

# kolshek:budget-app

You are building a personal budget dashboard for the user. This is an opinionated wizard — you make the technical decisions, the user makes the financial ones.

## Before You Start

1. Run `kolshek providers list --json` — if no providers, tell the user to run `kolshek providers add` in their terminal to connect an account.

   If providers exist but any show `authenticated: false`, use the a prompt:
   - question: "Some providers need re-authentication: {list provider names and IDs}. What do you want to do?"
   - options:
     - label: "Re-auth now", description: "I'll wait while you run `kolshek providers auth <id>` in another terminal"
     - label: "Skip for now", description: "Continue with whatever data is already synced"
   If they pick re-auth, wait for them to confirm they've done it, then re-run `kolshek providers list --json` to verify.

2. Run `kolshek transactions list --limit 1 --json` — if no transactions, use the a prompt:
   - question: "You don't have any transaction data yet. Want me to fetch it now?"
   - options:
     - label: "Fetch now", description: "I'll run kolshek fetch to pull your latest transactions"
     - label: "Skip", description: "I'll continue but the budget will have no real data"
   If yes, run `kolshek fetch --json` and handle exit codes (3=run `providers auth <id>`, 4=retry smaller range, 5=bank blocking, 10=partial success).

3. Check if transactions are categorized: `kolshek query "SELECT COUNT(*) as total, COUNT(CASE WHEN category IS NOT NULL THEN 1 END) as categorized FROM transactions" --json`. If less than half are categorized, use the a prompt:
   - question: "Most of your transactions aren't categorized yet. Categories make budgets much more useful."
   - options:
     - label: "Categorize first", description: "Run kolshek:categorize before continuing"
     - label: "Continue without", description: "Set up budget with uncategorized data"

4. Run `kolshek accounts --json` to understand what accounts they have.

## Step 1: Understand Their Spending

Before asking about budgets, show the user their actual data so they can make informed decisions.

Run `kolshek reports categories --from 90d --json` to get spending by category over the last 3 months.

Present a summary:

> Here's your spending over the last 3 months:
>
> | Category | Monthly Avg |
> |----------|------------|
> | Groceries | ₪2,340 |
> | Restaurants | ₪890 |
> | ... | ... |
>
> **Total monthly average: ₪X,XXX**

## Step 2: Budgeting Method

Ask the user with these exact parameters:
- question: "Which budgeting approach works for you? Pick a proven method or describe your own."
- options:
  - label: "Envelope budgeting", description: "Give every category a fixed monthly limit (groceries: ₪2,000, dining: ₪800). Simple and visual."
  - label: "EveryDollar (zero-based)", description: "Dave Ramsey's method. Assign every shekel a job until ₪0 is unassigned."
  - label: "50/30/20", description: "50% on needs, 30% on wants, 20% on savings. Just set your income and the math is done."
  - label: "Pay yourself first", description: "Set a savings target, spend the rest guilt-free."

If the user picks "Other", they want a custom budget. Go to Step 3 → Custom Budget.

## Step 3: Method-Specific Setup

### Custom Budget

The user wants their own system. Have a conversation to understand what they want to track.

Ask the user:
- question: "What's your monthly income in ILS?"
- options:
  - label: "₪8,000", description: ""
  - label: "₪12,000", description: ""
  - label: "₪15,000", description: ""
  - label: "₪20,000", description: ""

Then ask them to describe their budgeting approach in their own words. Guide the conversation to extract:

1. **What to track** — Do they want per-category limits? Group-level limits (like needs/wants)? A single savings target? Some combination?
2. **Categories and limits** — Show them their actual spending from Step 1 and let them define which categories to track and what limits to set. They may want to group some categories, ignore others, or add new ones.
3. **Rules** — Any specific rules? e.g., "dining + entertainment combined should stay under ₪2,000", "savings must be at least ₪3,000", "no limit on groceries but track it"

Present their custom setup as a table for confirmation:

> Here's your custom budget:
>
> | What | Limit | Notes |
> |------|-------|-------|
> | ... | ... | ... |
>
> Does this look right?

Under the hood, map their custom budget to the closest config structure:
- Per-category limits → use `envelopes` in config (set `method.type = "custom"`)
- Group-level limits → use `categories_mapping` + `thresholds` with custom percentages
- Savings target → use `pay_yourself_first` fields
- Mixed → combine all relevant config sections

The dashboard/bot code should handle `method.type = "custom"` by rendering whatever config sections are present — show envelope cards for categories that have limits, show group bars for groups that have limits, show savings progress if a savings target exists.

### Envelope Budgeting

Ask the user:
- question: "What's your monthly income in ILS?"
- options: "₪8,000", "₪12,000", "₪15,000", "₪20,000"

Then for each spending category found in Step 1, suggest an envelope amount based on their actual spending (round up slightly to be realistic). Present as a table:

> Based on your spending, here are suggested envelopes:
>
> | Category | Actual Avg | Suggested Limit |
> |----------|-----------|-----------------|
> | Groceries | ₪2,340 | ₪2,500 |
> | Restaurants | ₪890 | ₪900 |
> | Transport | ₪650 | ₪700 |
> | ... | ... | ... |
> | **Unallocated** | | **₪X,XXX** |
>
> Adjust any of these?

Let the user adjust via user prompt or free text. The unallocated amount is their buffer/savings.

### EveryDollar (Zero-Based)

Ask the user:
- question: "What's your monthly income in ILS?"
- options: "₪8,000", "₪12,000", "₪15,000", "₪20,000"

Show their actual spending categories and suggest allocations. The key constraint: **every shekel must be assigned**. Present:

> Your income: ₪15,000
>
> | Category | Suggested | Purpose |
> |----------|----------|---------|
> | Rent/Mortgage | ₪4,500 | Need |
> | Groceries | ₪2,500 | Need |
> | Transport | ₪700 | Need |
> | Restaurants | ₪800 | Want |
> | Entertainment | ₪500 | Want |
> | Savings | ₪3,000 | Savings |
> | Debt repayment | ₪0 | Debt |
> | Buffer | ₪2,000 | Buffer |
> | **Remaining** | **₪0** | Must be zero! |
>
> Adjust any of these?

Keep iterating until remaining = ₪0. Ask about debt if relevant.

### 50/30/20

Ask the user:
- question: "What's your monthly income in ILS?"
- options: "₪8,000", "₪12,000", "₪15,000", "₪20,000"

Auto-calculate:
- Needs (50%): ₪X — rent, bills, groceries, transport, insurance
- Wants (30%): ₪X — dining, entertainment, shopping, subscriptions
- Savings (20%): ₪X — savings, investments, debt repayment

Map their existing categories into needs/wants/savings. Ask them to confirm or adjust the mapping.

### Pay Yourself First

Ask the user:
- question: "What's your monthly income in ILS?"
- options: "₪8,000", "₪12,000", "₪15,000", "₪20,000"

Then use user prompt again:
- question: "How much do you want to save each month?"
- options:
  - label: "10%", description: "₪{income*0.1} per month"
  - label: "20%", description: "₪{income*0.2} per month"
  - label: "30%", description: "₪{income*0.3} per month"

Then ask if they have a savings goal (target amount and date). That's it — the rest is "spend freely."

## Step 4: Alert Preferences

Ask the user with multiSelect: true:
- question: "When should I alert you?"
- multiSelect: true
- options:
  - label: "Large transactions", description: "Flag purchases over a threshold (suggest ₪500 based on their data)"
  - label: "Budget exceeded", description: "Notify when a category or group goes over its limit"
  - label: "Weekly summary", description: "Brief spending recap every Sunday"
  - label: "Monthly report", description: "Full breakdown at month end"

## Step 5: Save Configuration

Write budget config to the platform-correct config directory. First resolve the path:

```bash
bun -e "import envPaths from 'env-paths'; console.log(envPaths('kolshek').config)"
```

Write the TOML file to `{resolved_path}/budget.toml`. Use `mkdir -p` to ensure the directory exists. Do NOT hardcode `~/.config/kolshek/` — on Windows the path is `AppData/Roaming/kolshek-nodejs/Config`.

```toml
[method]
type = "envelope"                    # envelope | everydollar | 50_30_20 | pay_yourself_first | custom
monthly_income = 15000

[envelopes]                          # only for envelope / everydollar / custom with category limits
groceries = 2500
restaurants = 900
transport = 700
entertainment = 500
shopping = 1000
savings = 3000

[thresholds]                         # for 50/30/20 or custom with group limits
needs_pct = 50
wants_pct = 30
savings_pct = 20

[pay_yourself_first]                 # for PYF or custom with savings target
savings_amount = 3000
savings_goal = 50000
savings_goal_date = "2027-01-01"

[alerts]
large_transaction = 500
notify_over_budget = true
weekly_summary = true
monthly_report = true

[categories_mapping]                 # maps categories to budget groups
needs = ["groceries", "transport", "rent", "utilities", "health", "insurance"]
wants = ["restaurants", "entertainment", "shopping", "subscriptions"]
savings = ["savings", "investments"]
```

Only include sections relevant to their chosen method.

## Step 6: Build App

Ask the user:
- question: "Where do you want to see your budget data?"
- options:
  - label: "Web dashboard", description: "Local PWA at localhost:3000. Charts, tables, budget progress."
  - label: "Telegram bot", description: "Get balance checks, budget status, and alerts right in Telegram."
  - label: "Both", description: "Dashboard for deep analysis, bot for quick checks and alerts."

### Set up the app skeleton

Check if `kolshek-dashboard/` or `kolshek-bot/` already exists. If it does, skip cloning — just add your module alongside existing ones.

If the directory doesn't exist, clone it:

**Web dashboard:**
```bash
git clone https://github.com/DaveDushi/kolshek-dashboard.git ./kolshek-dashboard
```

**Telegram bot:**
```bash
git clone https://github.com/DaveDushi/kolshek-bot.git ./kolshek-bot
```

**IMPORTANT: Never edit skeleton files.** Do not touch anything in `src/`. The skeleton auto-discovers modules from `modules/*/`. You only create files inside `modules/budget/`.

### Create budget module — Web Dashboard

Create all budget files inside `modules/budget/`. The skeleton's router.ts auto-prefixes routes to `/api/budget/*`, App.tsx auto-prefixes pages to `#/budget/*`, and Dashboard.tsx renders your DashboardWidget on the home page.

#### `modules/budget/shared/budget-types.ts`

Budget-specific TypeScript interfaces:
```ts
export interface BudgetProgress {
  category: string;
  spent: number;
  limit: number;
  percentage: number;
}

export interface BudgetConfig {
  method: {
    type: "envelope" | "everydollar" | "50_30_20" | "pay_yourself_first" | "custom";
    monthly_income: number;
  };
  envelopes?: Record<string, number>;
  thresholds?: { needs_pct: number; wants_pct: number; savings_pct: number };
  pay_yourself_first?: { savings_amount: number; savings_goal?: number; savings_goal_date?: string };
  alerts?: { large_transaction?: number; notify_over_budget?: boolean; weekly_summary?: boolean; monthly_report?: boolean };
  categories_mapping?: { needs?: string[]; wants?: string[]; savings?: string[] };
}
```

#### `modules/budget/shared/budget-config.ts`

Reads `budget.toml` from the platform config directory (resolved via `env-paths`). Reads fresh on every call — do NOT cache the result, since the file may be written after first server start:
```ts
import { join } from "path";
import envPaths from "env-paths";
import { parse } from "smol-toml";
import { readFileSync } from "fs";
import type { BudgetConfig } from "./budget-types.js";

const paths = envPaths("kolshek");

export function loadBudgetConfig(): BudgetConfig | null {
  try {
    const text = readFileSync(join(paths.config, "budget.toml"), "utf-8");
    return parse(text) as unknown as BudgetConfig;
  } catch { return null; }
}
```

#### `modules/budget/shared/budget-queries.ts`

Budget progress queries (uses `getDb()` from `../../../shared/db.js`):
- `getBudgetProgress(config, month?)` — computes spent vs limit per envelope/group/PYF method
- `getNewLargeTransactions(since, threshold)` — finds transactions above threshold since a timestamp

Implement the full logic for all 5 budget methods (envelope, everydollar, 50/30/20, pay-yourself-first, custom). For `custom`, render whatever config sections are present.

#### `modules/budget/routes.ts`

Exports a `RouteModule` with budget API routes. Routes use **relative patterns** — the skeleton auto-prefixes `/api/budget`:

```ts
import type { RouteModule } from "../../src/module.js";
// import your handlers from ./api/*.ts

const budgetRoutes: RouteModule = {
  routes: [
    // /overview → served at /api/budget/overview
    { method: "GET", pattern: "/overview", handler: overviewHandler },
    // /progress → served at /api/budget/progress
    { method: "GET", pattern: "/progress", handler: progressHandler },
    // /transactions → served at /api/budget/transactions
    { method: "GET", pattern: "/transactions", handler: transactionsHandler },
  ],
};

export default budgetRoutes;
```

#### `modules/budget/api/` — Route handler implementations

- `overview.ts` — overview data (monthly totals, budget progress, recent transactions)
- `progress.ts` — budget progress by method (envelope grid / 50-30-20 bars / PYF ring)
- `transactions.ts` — paginated, filtered transaction list

Each handler must return complete data. Do not create placeholder handlers that return empty objects.

#### `modules/budget/pages.tsx`

Exports a `PageModule`. Pages use **relative hashes** — the skeleton auto-prefixes `#/budget`:

```tsx
import type { PageModule } from "../../src/module.js";
import { Overview } from "./pages/Overview.js";
import { Budget } from "./pages/Budget.js";
import { Transactions } from "./pages/Transactions.js";
import { Reports } from "./pages/Reports.js";
import { BudgetCard } from "./components/BudgetCard.js";

const budgetModule: PageModule = {
  name: "budget",
  navItems: [
    { label: "Budget", hash: "", icon: "💰" },
    { label: "Transactions", hash: "transactions", icon: "📋" },
    { label: "Reports", hash: "reports", icon: "📈" },
  ],
  pages: {
    "": Overview,
    "details": Budget,
    "transactions": Transactions,
    "reports": Reports,
  },
  DashboardWidget: BudgetCard,
};

export default budgetModule;
```

#### `modules/budget/pages/` — React page components

Tailored to the user's chosen budget method:
- `Overview.tsx` — overview with method-specific budget widget + spending chart + recent transactions
- `Budget.tsx` — full budget view:
  - Envelope/EveryDollar/Custom with envelopes: grid of BudgetCard components (category, spent/limit, progress bar green→yellow→red)
  - 50/30/20: three big progress bars (needs/wants/savings) with category drill-down
  - PYF: savings progress ring + spending total
  - Custom: render whatever config sections are present
- `Transactions.tsx` — filterable list with search, date range, category filter
- `Reports.tsx` — charts: monthly spending trend (line chart), category breakdown (pie/donut chart), merchant breakdown (bar chart)

**Every component must be fully implemented.** Do not create placeholder components that return `null` or empty divs. If a chart needs data, wire it to the appropriate API endpoint. If a page isn't needed for this method, omit it from the pages map entirely.

#### `modules/budget/components/` — Module-specific components

Budget cards, charts (use recharts), transaction table, alert banner. Include a `BudgetCard.tsx` that serves as the `DashboardWidget` — a compact summary card shown on the home page grid.

### Create budget module — Telegram Bot

Create all budget files inside `modules/budget/`. The skeleton's bot.ts auto-discovers commands and alerts.

#### `modules/budget/shared/`

Same `budget-types.ts`, `budget-config.ts`, `budget-queries.ts` as the dashboard module (but importing from `../../../shared/db.js`).

#### `modules/budget/commands.ts`

Exports a `CommandModule`:
```ts
import type { CommandModule } from "../../src/module.js";

const budgetCommands: CommandModule = {
  register: (bot) => {
    bot.command("balance", balanceCommand);
    bot.command("budget", budgetCommand);
    bot.command("recent", recentCommand);
    bot.command("spending", spendingCommand);
  },
  commands: [
    { name: "balance", description: "Account balances summary" },
    { name: "budget", description: "Budget progress" },
    { name: "recent", description: "Recent transactions" },
    { name: "spending", description: "Current month spending" },
  ],
};

export default budgetCommands;
```

#### `modules/budget/alerts.ts`

Exports an `AlertModule` — based on Step 4 preferences:
```ts
import type { AlertModule } from "../../src/module.js";

const budgetAlerts: AlertModule = {
  alerts: [
    { name: "large-transaction", intervalMs: 5 * 60 * 1000, checkFn: checkLargeTransactions },
    { name: "over-budget", intervalMs: 60 * 60 * 1000, checkFn: checkOverBudget },
  ],
};

export default budgetAlerts;
```

### Verify

Run both a build and typecheck to catch errors early:

```bash
# Web dashboard
cd kolshek-dashboard && bun install && bun run build && bunx tsc --noEmit
# Verify: curl localhost:3000 returns HTML, /api/budget/* routes return data

# Telegram bot
cd kolshek-bot && bun install && bunx tsc --noEmit
# Verify: bot responds to /start, /balance, /budget commands
```

If the typecheck fails, fix the errors before proceeding. If the build fails, check the build output for the specific error.

## Step 7: Handoff

Tell the user based on what was built:

**Web dashboard:**
> Your budget dashboard is ready! Run:
> ```
> cd kolshek-dashboard && bun run dev
> ```
> Open http://localhost:3000 to see it.

**Telegram bot:**
> Your Telegram bot is ready! Run:
> ```
> cd kolshek-bot && bun run dev
> ```
> Send /start to your bot in Telegram.

**Both:**
> Both are ready! Start them with:
> ```
> cd kolshek-dashboard && bun run dev &
> cd kolshek-bot && bun run dev &
> ```

Then:
> **To keep your data fresh**, run `kolshek fetch` periodically (or set up a cron job).
>
> Want me to tweak anything — colors, layout, add more charts, extra bot commands?

---

# Reference: KolShek CLI


You are working with **KolShek** (כל שקל), an Israeli finance CLI that scrapes bank and credit card data. This document is your reference for using it correctly.

## Rules of Engagement

1. **Always use `--json`** when parsing output programmatically. Only omit it when showing output directly to the user.
2. **Always run `kolshek db schema <table>`** before writing SQL queries against that table.
3. **Never handle credentials directly.** Guide the user to run `kolshek providers add` or `kolshek providers auth <id>` interactively in their terminal. Credentials are stored in the OS keychain and are never exposed.
4. **Protect context window.** Use `--limit` on large result sets. Filter with `--from`/`--to` date ranges. Prefer targeted queries over full table scans.
5. **Check exit codes** on every command and handle accordingly (see table below).
6. **Providers can have aliases.** The same bank/card company can have multiple instances (e.g., personal + joint account). Use the alias to target a specific instance, or company ID to target all instances of that company.

## Command Quick Reference

### Provider Management
```
kolshek providers list [--json]
kolshek providers add                          # interactive — user runs this themselves, supports multi-instance with aliases
kolshek providers auth <id>                    # interactive — update credentials for existing provider
kolshek providers remove <id> [--json]
kolshek providers test <id> [--json]
```

**Provider resolution in commands:** providers can be referenced by numeric ID, alias (exact match), or company ID (matches ALL instances of that company).

### Fetching Data
```
kolshek fetch [providers...] [--from <date>] [--to <date>] [--force] [--type <bank|card>] [--stealth] [--visible] [--json]
```

Fetch output includes `scrapeStartDate` and `scrapeEndDate` per provider in JSON mode.

Examples:
```
kolshek fetch                      # all providers
kolshek fetch leumi                # all Bank Leumi instances
kolshek fetch leumi-joint          # only the "leumi-joint" alias
kolshek fetch 1 2 3                # specific IDs
```

### Scheduling
```
kolshek schedule set --every <interval> [--json]   # register recurring fetch (e.g., 6h, 12h, 24h — range: 1h–168h)
kolshek schedule remove [--json]                    # unregister scheduled task
kolshek schedule status [--json]                    # show schedule status + next run estimate
```

Uses OS scheduler (Windows Task Scheduler / cron / systemd). Config stored in data dir.

### Viewing Data
```
kolshek transactions list [--from] [--to] [--provider] [--type] [--account] [--min] [--max] [--status] [--sort] [--limit] [--json]
kolshek transactions search <query> [--from] [--to] [--provider] [--limit] [--json]
kolshek transactions delete <id> [--yes] [--json]
kolshek transactions export <csv|json> [--from] [--to] [--output <path>] [--json]
kolshek accounts [--provider] [--type] [--json]
```

### Categorization
```
kolshek categorize rule add <category> --match <pattern> [--json]
kolshek categorize rule list [--json]
kolshek categorize rule remove <id> [--json]
kolshek categorize apply [--json]
kolshek categorize list [--json]
kolshek categorize rename <old> <new> [--dry-run] [--json]
kolshek categorize migrate --file <path> [--dry-run] [--json]
kolshek categorize reassign --match <pattern> --to <category> [--dry-run] [--json]
kolshek categorize reassign --file <path> [--dry-run] [--json]
kolshek categorize rule import [file] [--json]
```

### Translation (Hebrew→English)
```
kolshek translate rule add <english> --match <pattern> [--json]
kolshek translate rule list [--json]
kolshek translate rule remove <id> [--json]
kolshek translate apply [--json]
kolshek translate seed [--json]
kolshek translate rule import [file] [--json]
```

### Spending & Income Analysis
```
kolshek spending [month] [--group-by <category|merchant|provider>] [--category <name>] [--top <n>] [--type] [--json]
kolshek income [month] [--salary-only] [--include-refunds] [--json]
kolshek trends [months] [--mode <total|category|fixed-variable>] [--category <name>] [--type] [--json]
kolshek insights [--months <n>] [--json]
```

Month formats: `current`, `prev`, `-3`, `2026-03`, or omit for current month.

**Income defaults to bank accounts only** — CC positive amounts are refunds, not income. Use `--include-refunds` to see them.

### Reports
```
kolshek reports monthly [--from] [--to] [--type] [--json]
kolshek reports categories [--from] [--to] [--type] [--json]
kolshek reports merchants [--from] [--to] [--type] [--limit] [--json]
kolshek reports balance [--json]
```

### Database & Queries
```
kolshek db tables [--json]
kolshek db schema <table> [--json]
kolshek query <sql> [--limit] [--json]
```

### Setup
```
kolshek init [--json]              # interactive wizard — loops to add multiple providers
```

### JSON Output Envelope

**Success:**
```json
{ "success": true, "data": { ... }, "metadata": { "count": 42, "duration": "1.2s" } }
```

**Error:**
```json
{ "success": false, "error": { "code": "AUTH_FAILED", "message": "...", "retryable": true, "suggestions": ["..."] } }
```

### Date Formats

All `--from`/`--to` date flags accept: `YYYY-MM-DD`, `DD/MM/YYYY`, or relative like `30d` (last 30 days).

Month arguments (spending, income, trends) accept: `current`, `prev`, `-3` (3 months ago), `2026-03`.

### Exit Codes

| Code | Meaning | Agent Action |
|------|---------|--------------|
| 0 | Success | Continue |
| 1 | General error | Read error message, fix and retry |
| 2 | Bad arguments | Fix command syntax |
| 3 | Auth failure | Tell user to run `kolshek providers auth <id>` to re-authenticate |
| 4 | Timeout | Retry with smaller date range (`--from 7d`) |
| 5 | Blocked by bank | Wait and retry later, inform user |
| 10 | Partial success | Use returned data, report which providers failed |

## DB Schema Overview

**Sign convention:** negative `charged_amount` = expense, positive = income/refund.

**CC Billing:** Transactions categorized as `"CC Billing"` are internal bank-to-CC transfers. Report commands auto-exclude them. When writing custom SQL for expenses, add `AND COALESCE(category, '') != 'CC Billing'` to avoid double-counting.

**`authenticated` field:** appears in `kolshek providers list --json` output but is NOT a DB column — it's computed at runtime by checking the OS keychain.

### Tables

- **providers** — configured bank/credit card scrapers (`id`, `company_id`, `alias`, `display_name`, `type`, `last_synced_at`, `created_at`)
- **accounts** — discovered accounts (`id`, `provider_id`, `account_number`, `display_name`, `balance`, `currency`, `created_at`)
- **transactions** — all scraped transactions (`id`, `account_id`, `type`, `identifier`, `date`, `processed_date`, `original_amount`, `original_currency`, `charged_amount`, `charged_currency`, `description`, `description_en`, `memo`, `status`, `installment_number`, `installment_total`, `category`, `hash`, `unique_id`, `created_at`, `updated_at`)
- **sync_log** — fetch history (`id`, `provider_id`, `started_at`, `completed_at`, `status`, `transactions_added`, `transactions_updated`, `error_message`, `scrape_start_date`, `scrape_end_date`)
- **category_rules** — auto-categorization rules (`id`, `category`, `conditions` (JSON), `priority`, `created_at`)
- **translation_rules** — Hebrew→English translations (`id`, `english_name`, `match_pattern`, `created_at`)

### Common SQL Patterns

```sql
-- Monthly spending by category
SELECT category, SUM(charged_amount) as total
FROM transactions
WHERE date >= '2026-01-01' AND date < '2026-02-01' AND charged_amount < 0
GROUP BY category ORDER BY total;

-- Top merchants (with translated names)
SELECT COALESCE(description_en, description) as merchant, COUNT(*) as count, SUM(charged_amount) as total
FROM transactions WHERE charged_amount < 0
GROUP BY merchant ORDER BY total LIMIT 20;

-- Daily spending trend
SELECT date, SUM(charged_amount) as daily_total
FROM transactions WHERE charged_amount < 0 AND date >= '2026-02-01'
GROUP BY date ORDER BY date;
```

Always run `kolshek db schema <table>` first to verify column names before writing queries.

## Direct SQL — Escape Hatch

When built-in commands can't answer the question, use `kolshek query "<sql>" --json`:
- **Read-only** — only SELECT, WITH, EXPLAIN, PRAGMA are allowed
- **Auto-LIMIT** — defaults to 100 rows if no LIMIT clause
- **Schema discovery** — run `kolshek db tables` then `kolshek db schema <table>` first

Example queries:

```sql
-- Find recurring subscriptions (same merchant+amount, 3+ months)
SELECT COALESCE(description_en, description) AS merchant,
  ROUND(ABS(charged_amount), 2) AS amount,
  COUNT(DISTINCT strftime('%Y-%m', date)) AS months
FROM transactions WHERE charged_amount < 0
  AND date >= date('now', '-180 days')
GROUP BY merchant, ROUND(ABS(charged_amount), 2)
HAVING months >= 3 ORDER BY amount DESC

-- Spending by day of week
SELECT CASE CAST(strftime('%w', date) AS INTEGER)
  WHEN 0 THEN 'Sun' WHEN 1 THEN 'Mon' WHEN 2 THEN 'Tue'
  WHEN 3 THEN 'Wed' WHEN 4 THEN 'Thu' WHEN 5 THEN 'Fri'
  WHEN 6 THEN 'Sat' END AS day,
  ROUND(SUM(ABS(charged_amount)), 2) AS total
FROM transactions WHERE charged_amount < 0
  AND date >= date('now', '-90 days')
GROUP BY strftime('%w', date) ORDER BY total DESC

-- Installment obligations
SELECT COALESCE(description_en, description) AS merchant,
  installment_number, installment_total,
  ROUND(ABS(charged_amount), 2) AS payment,
  (installment_total - installment_number) AS remaining
FROM transactions WHERE installment_total > 1
  AND date >= date('now', '-30 days')
ORDER BY payment DESC
```

## Skill Startup Checks

All skills should run these checks before starting work:

1. **Providers configured:** `kolshek providers list --json` — if empty, guide user to `kolshek providers add`. If any show `authenticated: false`, tell user to run `kolshek providers auth <id>`.
2. **Transaction data exists:** `kolshek transactions list --limit 1 --json` — if empty, offer to fetch.
3. **Data freshness:** `kolshek query "SELECT MAX(completed_at) as last_sync FROM sync_log WHERE status = 'success'" --json` — if over 24h old, suggest `kolshek fetch`.

## User Configuration

Each skill writes its own config file under the platform config directory (resolved via `env-paths("kolshek").config` — `~/.config/kolshek` on Linux/macOS, `AppData/Roaming/kolshek-nodejs/Config` on Windows):

| File | Written by | Purpose |
|------|-----------|---------|
| `budget.toml` | `/kolshek:budget-app` | Budget method, envelopes, income, alerts |

Check for these files at the start of any finance-related task. Use them to tailor responses.

Skills are modular — the user runs `/kolshek:init` once to get data flowing, then uses project-specific skills to build things on top of their data.
