---
name: analyze
description: >
  Deep-dive financial analysis — maps income and expenses, identifies savings
  opportunities, and creates a phased action plan with budget targets.
  Use when: analyze finances, financial checkup, deep dive, find savings,
  audit expenses, map income, understand where money goes, check financial health.
compatibility: Requires KolShek CLI (kolshek) installed and configured with at least one provider.
metadata:
  author: kolshek
  version: "0.3.8"
allowed-tools: Bash Read Write AskUserQuestion
---

# /kolshek:analyze

You are performing a comprehensive financial analysis. This is a one-time (or periodic) deep dive that maps the user's entire financial picture, identifies savings opportunities, and produces an actionable plan with budget targets.

## Before You Start

Read `references/cli-reference.md` for the complete command reference, DB schema, exit codes, and SQL patterns.

Run startup checks:
1. `kolshek providers list --json` — if empty, guide user to `kolshek providers add`.
2. `kolshek transactions list --limit 1 --json` — if empty, offer to fetch.
3. `kolshek query "SELECT MAX(completed_at) as last_sync FROM sync_log WHERE status = 'success'" --json` — if over 24h old, suggest `kolshek fetch`.

**Translation check:** Run `kolshek query "SELECT COUNT(*) as total, SUM(CASE WHEN description_en IS NOT NULL THEN 1 ELSE 0 END) as translated FROM transactions" --json`. If most descriptions lack `description_en`, suggest running `/kolshek:translate` first — analysis with English descriptions is far more reliable.

**Categorization check:** Run `kolshek query "SELECT COUNT(*) as total, SUM(CASE WHEN category IS NOT NULL AND category != '' THEN 1 ELSE 0 END) as categorized FROM transactions" --json`. If most transactions are uncategorized, suggest running `/kolshek:categorize` first — category-based analysis requires categorized data.

**Resolve config dir** (needed for budget.toml later):
```
bun -e "import envPaths from 'env-paths'; console.log(envPaths('kolshek').config)"
```
Store this path — you will use it in Step 7.

**Build classification exclusion list:** Run `kolshek categorize classify list --json` to get all categories and their classifications. By default, exclude categories classified as `cc_billing` and `transfer` from expense analysis (these are internal movements, not real spending). Ask the user if they want to adjust — they may want to also exclude `investment`, `debt`, `savings`, or include categories that are normally excluded. Build `$EXCLUDE_SQL` from their choices, e.g.: `category NOT IN (SELECT name FROM categories WHERE classification IN ('cc_billing', 'transfer'))`. If the user wants no exclusions, omit this clause entirely.

## Step 1: Establish Analysis Window

Ask the user:
- "Full analysis — last 3 months" (recommended)
- "Extended analysis — last 6 months"
- "Custom date range"

Verify data coverage:
```
kolshek query "SELECT MIN(date) as earliest, MAX(date) as latest, COUNT(*) as total FROM transactions" --json
```

If data doesn't cover the requested window, warn the user and offer to fetch more: `kolshek fetch --from <date> --json`.

Set `$FROM` and `$TO` dates and `$MONTHS` count for use in subsequent steps.

## Step 2: Income Mapping

Run for each month in the analysis window:
```
kolshek income <YYYY-MM> --json
```

The response includes `summary.salary`, `summary.transfers`, `summary.refunds`, `summary.other` and individual transactions with `incomeType`.

Also detect recurring vs one-time income sources:
```
kolshek query "SELECT COALESCE(t.description_en, t.description) as source, COUNT(DISTINCT strftime('%Y-%m', t.date)) as months_seen, ROUND(AVG(t.charged_amount), 2) as avg_amount, ROUND(SUM(t.charged_amount), 2) as total FROM transactions t JOIN accounts a ON t.account_id = a.id JOIN providers p ON a.provider_id = p.id WHERE t.charged_amount > 0 AND p.type = 'bank' AND t.date >= '$FROM' GROUP BY source ORDER BY total DESC" --json
```

Present:

> **Income Sources**
>
> | Source | Type | Months Seen | Avg/Month | Total |
> |--------|------|-------------|-----------|-------|
> | Salary - Acme Corp | Fixed (Salary) | 3/3 | ₪15,000 | ₪45,000 |
> | Bit Transfer - Mom | One-time | 1/3 | ₪2,000 | ₪2,000 |
>
> **Monthly fixed income: ₪X | Variable: ₪Y | Total avg: ₪Z**

Classification rules:
- Source appears in all months with similar amount → **Fixed**
- Source appears once or amounts vary wildly → **One-time/Variable**
- Salary-type income (from `kolshek income`) → always **Fixed**

**Important:** All subsequent calculations compare against fixed income only — never include one-time income.

## Step 3: Expense Mapping

Run per-month spending:
```
kolshek spending <YYYY-MM> --json
kolshek spending <YYYY-MM> --group-by provider --json
```

Run fixed vs variable analysis:
```
kolshek trends $MONTHS --mode fixed-variable --json
```

Classify each category into **Mandatory** or **Discretionary**:
- Mandatory: Housing, Groceries, Utilities, Healthcare, Transportation, Insurance, Education, Childcare
- Discretionary: Restaurants, Entertainment, Shopping, Fashion, Subscriptions, Travel, Gifts
- Mixed: Food (split between Groceries=mandatory, Restaurants=discretionary)
- Use the `fixedMerchants` from `trends --mode fixed-variable` to identify fixed costs within each category

Present two tables:

> **Mandatory Expenses (avg/month)**
>
> | Category | Monthly Avg | % of Income | Fixed/Variable |
> |----------|-------------|-------------|----------------|
> | Housing | ₪5,000 | 33% | Fixed |
> | Groceries | ₪2,800 | 19% | Variable |
>
> **Discretionary Expenses (avg/month)**
>
> | Category | Monthly Avg | % of Income | Fixed/Variable |
> |----------|-------------|-------------|----------------|
> | Restaurants | ₪1,200 | 8% | Variable |
> | Entertainment | ₪800 | 5% | Variable |

Present per-provider (per-card) breakdown:

> **Per-Card Breakdown**
>
> | Provider | Monthly Avg | Mandatory % | Discretionary % |
> |----------|-------------|-------------|-----------------|
> | Visa Cal (personal) | ₪4,500 | 40% | 60% |
> | Leumi (joint) | ₪8,000 | 85% | 15% |

**Bottom line:**

> Fixed income: ₪X/month
> Total expenses: ₪Y/month (Z% mandatory, W% discretionary)
> Monthly surplus/deficit: ₪N

## Step 4: Trends & Outliers

Run:
```
kolshek trends $MONTHS --json
kolshek insights --months $MONTHS --json
```

Run top 20 largest transactions (apply `$EXCLUDE_SQL` from Before You Start):
```
kolshek query "SELECT COALESCE(description_en, description) as merchant, ROUND(ABS(charged_amount), 2) as amount, date, category FROM transactions WHERE charged_amount < 0 AND $EXCLUDE_SQL AND date >= '$FROM' ORDER BY ABS(charged_amount) DESC LIMIT 20" --json
```

Present:

> **Monthly Trend**
>
> | Month | Income | Expenses | Net | Savings Rate |
> |-------|--------|----------|-----|--------------|
> | 2026-01 | ₪16,000 | ₪13,500 | +₪2,500 | 15.6% |
> | 2026-02 | ₪15,000 | ₪12,800 | +₪2,200 | 14.7% |
>
> **Top 20 Largest Transactions**
>
> | # | Merchant | Amount | Date | Category |
> |---|----------|--------|------|----------|
> | 1 | Rent Payment | ₪5,000 | 2026-03-01 | Housing |

Flag one-time/seasonal expenses (annual insurance, holiday spending, repairs) separately — note which items in the top 20 are one-time vs recurring.

Present any alerts from `kolshek insights` (category spikes, new merchants, large transactions, recurring changes).

## Step 5: Installment Obligations (תשלומים)

Run:
```
kolshek query "SELECT COALESCE(description_en, description) AS merchant, installment_number, installment_total, ROUND(ABS(charged_amount), 2) AS monthly_payment, (installment_total - installment_number) AS remaining_payments, ROUND(ABS(charged_amount) * (installment_total - installment_number), 2) AS remaining_total FROM transactions WHERE installment_total > 1 AND date >= date('now', '-30 days') ORDER BY remaining_total DESC" --json
```

Present:

> **Active Installment Plans (תשלומים)**
>
> | Merchant | Payment | Progress | Remaining | Total Left |
> |----------|---------|----------|-----------|------------|
> | IKEA | ₪450/mo | 3/12 | 9 payments | ₪4,050 |
>
> **Monthly installment burden: ₪X**
> **Total remaining obligation: ₪Y**
> **Installments ending within 3 months: ₪Z/mo freed up**

Note which installments end soon — this is "automatic" future savings.

## Step 6: Savings Opportunities

Using all data collected above, identify savings in three tiers:

### A. Immediate Savings (no lifestyle change needed)

Detect recurring subscriptions:
```
kolshek query "SELECT COALESCE(description_en, description) AS merchant, ROUND(ABS(charged_amount), 2) AS amount, COUNT(DISTINCT strftime('%Y-%m', date)) AS months FROM transactions WHERE charged_amount < 0 AND date >= date('now', '-180 days') GROUP BY merchant, ROUND(ABS(charged_amount), 2) HAVING months >= 3 ORDER BY amount DESC" --json
```

Look for:
- Duplicate or overlapping subscriptions (e.g., Netflix + Disney+ + HBO)
- Unused recurring charges (small amounts the user may have forgotten)
- Insurance overlaps worth price-shopping
- Telecom/utility plans worth comparing

### B. Behavioral Savings (habit changes)

For each discretionary category, analyze spending frequency and suggest concrete targets:
- Not "eat out less" but "reduce from 8 restaurant visits at ₪150 avg to 4 visits — save ₪600/month"
- Identify spending patterns: concentrated on specific days? Impulse purchases? Weekend splurges?

### C. Structural Savings (big moves)

- If fixed obligations (housing + loans + insurance) exceed 40% of income, flag as structural
- If installment burden is high, note when it naturally decreases
- If a deficit remains after cutting all discretionary spending, note that income increase is needed — don't just suggest more cutting

Present combined savings table sorted by savings-to-effort ratio:

> **Savings Opportunities**
>
> | # | Opportunity | Current Cost | Monthly Saving | Annual Saving | Effort | Priority |
> |---|-------------|-------------|----------------|---------------|--------|----------|
> | 1 | Cancel duplicate streaming | ₪50/mo | ₪50 | ₪600 | Low | High |
> | 2 | Reduce restaurant visits 8→4/mo | ₪1,200/mo | ₪600 | ₪7,200 | Medium | High |
> | 3 | Switch mobile plan | ₪120/mo | ₪40 | ₪480 | Low | Medium |
>
> **Total potential monthly savings: ₪X**
> **Current monthly deficit: ₪Y**
> **Gap closed by savings: Z%**

Always provide concrete numbers. Never give generic advice.

## Step 7: Set Budget Targets

Ask the user:
- "Set budget targets based on this analysis" (recommended)
- "Skip budget targets for now"

If yes, propose targets for each spending category. Derive them from actual spending minus identified savings — targets should be challenging but realistic:

> **Proposed Budget Targets**
>
> | Category | Current Avg | Proposed Target | Monthly Saving |
> |----------|-------------|-----------------|----------------|
> | Groceries | ₪2,800 | ₪2,500 | ₪300 |
> | Restaurants | ₪1,200 | ₪800 | ₪400 |
> | Entertainment | ₪800 | ₪600 | ₪200 |
>
> **Total monthly spending target: ₪X**
> **Savings rate target: Y% of fixed income**
>
> Look good? You can adjust individual categories before I save.

After user approval, write `budget.toml` to the config directory (resolved in Before You Start):

```toml
# KolShek budget targets — managed by /kolshek:analyze
# Edit manually or re-run /kolshek:analyze to regenerate

[targets]
Groceries = 2500
Restaurants = 800
Entertainment = 600
# ... all categories with targets

[targets.meta]
updated = "YYYY-MM-DD"
total_spending = 12000
savings_rate_target = 20
```

If `budget.toml` already exists, show the current targets alongside proposed new ones and ask the user whether to update.

## Step 8: Phased Action Plan

Generate a personalized plan based on the savings opportunities from Step 6:

> **Week 1 — Quick Wins** (est. ₪X/month saved)
> - [ ] Cancel [specific subscriptions] — save ₪X/month
> - [ ] Call [insurance/telecom provider] for price comparison — potential ₪X/month
>
> **Month 1 — Behavioral Changes** (est. ₪X/month saved)
> - [ ] Restaurant budget: ₪X/month target (down from ₪Y)
> - [ ] [Other category-specific targets]
>
> **Quarter 1 — Structural Changes** (est. ₪X/month saved)
> - [ ] Research [provider/plan switching]
> - [ ] [Refinancing or other structural actions if applicable]
>
> **Total projected monthly savings: ₪X**
> **Projected savings rate after changes: Y%**

## Step 9: Summary

> **Financial Health Snapshot**
>
> | Metric | Value |
> |--------|-------|
> | Monthly fixed income | ₪X |
> | Monthly expenses | ₪X |
> | Current savings rate | X% |
> | Mandatory vs discretionary | X% / Y% |
> | Active installments | ₪X/mo (₪Y remaining) |
> | Identified savings potential | ₪X/mo |
> | Budget targets | Set / Not set |
>
> **Next steps:**
> - Run `/kolshek:review` monthly to track progress against these targets
> - Run `/kolshek:analyze` again in 3 months to refresh the deep dive
