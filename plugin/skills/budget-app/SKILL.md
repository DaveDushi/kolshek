---
name: budget-app
description: Design and build a personal budget dashboard or Telegram bot powered by your KolShek transaction data. Use when user asks to create a budget, build a spending dashboard, track spending limits, set up envelope budgeting, 50/30/20, or financial alerts in KolShek.
compatibility: Requires KolShek CLI (kolshek) installed and configured with transaction data.
metadata:
  author: kolshek
  version: "0.3.4"
allowed-tools: Bash Read Write Edit Glob Grep AskUserQuestion
---

# /kolshek:budget-app

You are building a personal budget dashboard for the user. This is an opinionated wizard — you make the technical decisions, the user makes the financial ones.

## Before You Start

1. Run `kolshek providers list --json` — if no providers, tell the user to run `kolshek providers add` in their terminal to connect an account.

   If providers exist but any show `authenticated: false`, use the AskUserQuestion tool:
   - question: "Some providers need re-authentication: {list provider names and IDs}. What do you want to do?"
   - options:
     - label: "Re-auth now", description: "I'll wait while you run `kolshek providers auth <id>` in another terminal"
     - label: "Skip for now", description: "Continue with whatever data is already synced"
   If they pick re-auth, wait for them to confirm they've done it, then re-run `kolshek providers list --json` to verify.

2. Run `kolshek transactions list --limit 1 --json` — if no transactions, use the AskUserQuestion tool:
   - question: "You don't have any transaction data yet. Want me to fetch it now?"
   - options:
     - label: "Fetch now", description: "I'll run kolshek fetch to pull your latest transactions"
     - label: "Skip", description: "I'll continue but the budget will have no real data"
   If yes, run `kolshek fetch --json` and handle exit codes (3=run `providers auth <id>`, 4=retry smaller range, 5=bank blocking, 10=partial success).

3. Check if transactions are categorized: `kolshek query "SELECT COUNT(*) as total, COUNT(CASE WHEN category IS NOT NULL THEN 1 END) as categorized FROM transactions" --json`. If less than half are categorized, use the AskUserQuestion tool:
   - question: "Most of your transactions aren't categorized yet. Categories make budgets much more useful."
   - options:
     - label: "Categorize first", description: "Run /kolshek:categorize before continuing"
     - label: "Continue without", description: "Set up budget with uncategorized data"

4. Run `kolshek accounts --json` to understand what accounts they have.

## Step 1: Understand Their Spending

Before asking about budgets, show the user their actual data so they can make informed decisions.

Run `kolshek spending --lifestyle --json` to get a lifestyle-focused spending breakdown (excludes categories the user has marked as non-spending like transfers, CC settlements, etc.). If no exclusions are configured, fall back to `kolshek reports categories --from 90d --json`.

Also check available analysis: `kolshek insights --json` and `kolshek trends --json` provide additional context (spending spikes, new merchants, multi-month trends).

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

Use the AskUserQuestion tool with these exact parameters:
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

Use the AskUserQuestion tool:
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

Use the AskUserQuestion tool:
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

Let the user adjust via AskUserQuestion or free text. The unallocated amount is their buffer/savings.

### EveryDollar (Zero-Based)

Use the AskUserQuestion tool:
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

Use the AskUserQuestion tool:
- question: "What's your monthly income in ILS?"
- options: "₪8,000", "₪12,000", "₪15,000", "₪20,000"

Auto-calculate:
- Needs (50%): ₪X — rent, bills, groceries, transport, insurance
- Wants (30%): ₪X — dining, entertainment, shopping, subscriptions
- Savings (20%): ₪X — savings, investments, debt repayment

Map their existing categories into needs/wants/savings. Ask them to confirm or adjust the mapping.

### Pay Yourself First

Use the AskUserQuestion tool:
- question: "What's your monthly income in ILS?"
- options: "₪8,000", "₪12,000", "₪15,000", "₪20,000"

Then use AskUserQuestion again:
- question: "How much do you want to save each month?"
- options:
  - label: "10%", description: "₪{income*0.1} per month"
  - label: "20%", description: "₪{income*0.2} per month"
  - label: "30%", description: "₪{income*0.3} per month"

Then ask if they have a savings goal (target amount and date). That's it — the rest is "spend freely."

## Step 4: Alert Preferences

Use the AskUserQuestion tool with multiSelect: true:
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

Use the AskUserQuestion tool:
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
