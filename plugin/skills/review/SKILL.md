---
name: review
description: >
  Monthly financial review — compares spending to previous month, checks budget
  targets, detects anomalies, and produces a progress report card.
  Use when: monthly review, month comparison, budget check, spending review,
  report card, how they did this month, progress check, monthly checkup.
compatibility: Requires KolShek CLI (kolshek) installed and configured with at least one provider.
metadata:
  author: kolshek
  version: "0.4.6"
allowed-tools: Bash Read Write AskUserQuestion
---

# /kolshek:review

You are performing a monthly financial review. This compares the current month to the previous month, checks budget target compliance, flags anomalies, and produces a report card with actionable recommendations.

## Before You Start

Read `references/cli-reference.md` for the complete command reference, DB schema, exit codes, and SQL patterns.

Run startup checks:
1. `kolshek providers list --json` — if empty, guide user to `kolshek providers add`.
2. `kolshek transactions list --limit 1 --json` — if empty, offer to fetch.
3. `kolshek query "SELECT MAX(completed_at) as last_sync FROM sync_log WHERE status = 'success'" --json` — if over 24h old, suggest `kolshek fetch` to get the latest data before reviewing.

**Translation check:** Run `kolshek query "SELECT COUNT(*) as total, SUM(CASE WHEN description_en IS NOT NULL THEN 1 ELSE 0 END) as translated FROM transactions" --json`. If most descriptions lack `description_en`, suggest `/kolshek:translate` first.

**Categorization check:** Run `kolshek query "SELECT COUNT(*) as total, SUM(CASE WHEN category IS NOT NULL AND category != '' THEN 1 ELSE 0 END) as categorized FROM transactions" --json`. If most transactions are uncategorized, suggest `/kolshek:categorize` first.

**Load budget targets:** Resolve config dir:
```
bun -e "import envPaths from 'env-paths'; console.log(envPaths('kolshek').config)"
```
Check if `budget.toml` exists in that directory. Read it if present — you need the `[targets]` section for Step 3. If missing, note that target compliance will be skipped and suggest running `/kolshek:analyze` to set targets.

**Build classification exclusion list:** Run `kolshek categorize classify list --json` to get all categories and their classifications. By default, exclude categories classified as `cc_billing` and `transfer` from expense comparisons. Ask the user if they want to adjust exclusions. Build `$EXCLUDE_SQL` from their choices, e.g.: `category NOT IN (SELECT name FROM categories WHERE classification IN ('cc_billing', 'transfer'))`. If the user wants no exclusions, omit this clause entirely.

## Step 1: Determine Review Period

Ask the user:
- "Review last full month vs the month before" (recommended — best run after the 10th when CC charges have posted)
- "Review current (partial) month vs last full month"
- "Custom: specify two months to compare"

Set `$CURRENT` and `$PREVIOUS` month identifiers (e.g., `2026-03` and `2026-02`).

Verify both months have sufficient data (apply `$EXCLUDE_SQL` from Before You Start):
```
kolshek query "SELECT strftime('%Y-%m', date) as month, COUNT(*) as txns, ROUND(SUM(CASE WHEN charged_amount < 0 THEN ABS(charged_amount) ELSE 0 END), 2) as total_spending FROM transactions WHERE date >= '$PREVIOUS-01' AND date < date('$CURRENT-01', '+1 month') AND $EXCLUDE_SQL GROUP BY month ORDER BY month" --json
```

If a month has very few transactions, warn the user that the comparison may be unreliable (data may still be syncing).

## Step 2: Category-by-Category Comparison

Run spending for both months:
```
kolshek spending $CURRENT --json
kolshek spending $PREVIOUS --json
```

Run income for both months:
```
kolshek income $CURRENT --json
kolshek income $PREVIOUS --json
```

Present comparison:

> **Spending Comparison: $CURRENT vs $PREVIOUS**
>
> | Category | This Month | Last Month | Change (₪) | Change (%) | Cause |
> |----------|-----------|-----------|------------|-----------|-------|
> | Groceries | ₪2,900 | ₪2,600 | +₪300 | +11.5% | Price increases / more shopping trips |
> | Restaurants | ₪800 | ₪1,400 | -₪600 | -42.9% | Fewer dining-out occasions |
> | Gifts | ₪500 | ₪0 | +₪500 | new | One-time (birthday?) |
>
> **Income Comparison**
>
> | Source Type | This Month | Last Month | Change |
> |------------|-----------|-----------|--------|
> | Fixed (Salary) | ₪15,000 | ₪15,000 | — |
> | Variable | ₪500 | ₪2,000 | -₪1,500 |

For each significant change (>10% or >₪200), identify the cause:
- Run `kolshek transactions search "<merchant>" --from $CURRENT-01 --to <end> --json` for specific merchants driving the change
- Flag one-time/seasonal expenses (annual insurance, holidays, repairs) separately so they don't skew the comparison

> **Summary:** Total spending ₪X this month vs ₪Y last month (Z% change). Excluding one-time items: ₪A vs ₪B (C% change).

## Step 3: Budget Target Compliance

**Skip this step if `budget.toml` was not found.** Instead show:

> Budget targets not configured. Run `/kolshek:analyze` to set up budget targets, or I can create a quick `budget.toml` now based on last month's spending.

If targets exist, compare each category:

> **Budget Target Compliance: $CURRENT**
>
> | Category | Target | Actual | Status | Over/Under |
> |----------|--------|--------|--------|------------|
> | Groceries | ₪2,500 | ₪2,900 | 🔴 OVER | +₪400 |
> | Restaurants | ₪800 | ₪800 | 🟢 MET | ₪0 |
> | Entertainment | ₪800 | ₪500 | 🟢 UNDER | -₪300 |
>
> **Overall: X of Y targets met**
> **Total spending: ₪X vs total target ₪Y (Z% over/under)**
> **Savings rate: X% vs target Y%**

For each target exceeded:
- Identify the specific transactions or pattern that caused the overrun
- Note whether it's a one-time spike or a trend (check if the same category was over last month too)

For each target met:
- Note what worked so it can be continued

## Step 4: Anomaly Detection

Run insights for the current month:
```
kolshek insights --months 1 --json
```

**New merchants** (first-time charges):
```
kolshek query "SELECT COALESCE(t.description_en, t.description) AS merchant, ROUND(ABS(t.charged_amount), 2) AS amount, t.date, t.category FROM transactions t WHERE t.charged_amount < 0 AND t.date >= '$CURRENT-01' AND t.date < date('$CURRENT-01', '+1 month') AND COALESCE(t.description_en, t.description) NOT IN (SELECT DISTINCT COALESCE(t2.description_en, t2.description) FROM transactions t2 WHERE t2.date < '$CURRENT-01' AND t2.charged_amount < 0) ORDER BY ABS(t.charged_amount) DESC LIMIT 10" --json
```

**Potential duplicates** (same merchant + similar amount on same day, apply `$EXCLUDE_SQL`):
```
kolshek query "SELECT COALESCE(description_en, description) AS merchant, date, ROUND(ABS(charged_amount), 2) AS amount, COUNT(*) AS occurrences FROM transactions WHERE charged_amount < 0 AND date >= '$CURRENT-01' AND date < date('$CURRENT-01', '+1 month') AND $EXCLUDE_SQL GROUP BY merchant, date, ROUND(ABS(charged_amount), 2) HAVING occurrences > 1 ORDER BY amount DESC" --json
```

**Large transactions** (over ₪500, apply `$EXCLUDE_SQL`):
```
kolshek query "SELECT COALESCE(description_en, description) AS merchant, ROUND(ABS(charged_amount), 2) AS amount, date, category FROM transactions WHERE charged_amount < 0 AND date >= '$CURRENT-01' AND date < date('$CURRENT-01', '+1 month') AND ABS(charged_amount) > 500 AND $EXCLUDE_SQL ORDER BY ABS(charged_amount) DESC" --json
```

Present:

> **Anomalies Detected**
>
> **New merchants:**
> - Merchant X — ₪Y on DATE (expected? one-time?)
>
> **Possible duplicates:**
> - Merchant A charged ₪X twice on DATE — verify this is intentional
>
> **Large transactions (>₪500):**
> - [list with amounts and categories]
>
> **Recurring charge changes** (from insights):
> - [any subscriptions that appeared, disappeared, or changed amount]

If a subscription that was marked for cancellation in a previous action plan still appears, flag it explicitly.

## Step 5: Trends & Progress

Run 3-month context:
```
kolshek trends 3 --json
```

Present:

> **3-Month Trend**
>
> | Month | Income | Expenses | Net | Savings Rate |
> |-------|--------|----------|-----|--------------|
> | $MONTH_3 | ₪X | ₪X | ₪X | X% |
> | $MONTH_2 | ₪X | ₪X | ₪X | X% |
> | $MONTH_1 | ₪X | ₪X | ₪X | X% |
>
> **Expense trend direction: rising / falling / stable**
> **3-month expense average: ₪X**
> **At the current trajectory: [projection — e.g., "deficit shrinking by ₪X/month, break-even in N months" or "spending stable, savings rate holding at X%"]**

If enough data exists (3+ months), compute a simple moving average to show direction.

## Step 6: Report Card

Synthesize everything into a one-page summary. This is designed to be shared in a household budget conversation — keep the tone encouraging and action-oriented, never judgmental.

> **Monthly Report Card: $CURRENT**
>
> **Overall Grade: 🟢 Green / 🟠 Orange / 🔴 Red**
>
> *(Green = met targets or improving, Orange = minor overruns or mixed signals, Red = significant overruns or worsening trend)*

Grade logic:
- **Green:** ≥70% of targets met AND savings rate ≥ target (or improving)
- **Orange:** 40-70% of targets met OR savings rate within 5pp of target
- **Red:** <40% of targets met OR savings rate >5pp below target OR expenses rising for 3+ months
- If no budget targets exist, grade based on: month-over-month improvement in spending and savings rate

> **Saved this month vs last:** ₪X more / less than previous month
>
> **3 things that improved:**
> 1. [Specific, with numbers — e.g., "Restaurant spending down ₪600 (43%) — target met"]
> 2. [...]
> 3. [...]
>
> **3 things that need attention:**
> 1. [Specific, with numbers — e.g., "Grocery spending exceeded target by ₪400"]
> 2. [...]
> 3. [...]
>
> **Top recommendation for next month:**
> [One concrete, actionable suggestion — e.g., "Review grocery receipts to identify where the ₪400 overrun came from. Consider switching staples to a cheaper supermarket."]

## Step 7: Target Adjustments

Skip if no `budget.toml` exists.

Review targets against reality:
- **Unrealistic targets** (exceeded for 2+ months in a row) → suggest increasing to a challenging-but-achievable level
- **Too-easy targets** (met effortlessly, >20% under for 2+ months) → suggest tightening
- **New categories** that appeared this month → suggest adding a target

Ask the user:
- "Update targets based on this review"
- "Keep current targets"

If updating, present proposed changes:

> **Proposed Target Adjustments**
>
> | Category | Current Target | Proposed | Reason |
> |----------|---------------|----------|--------|
> | Groceries | ₪2,500 | ₪2,800 | Exceeded 2 months in a row — prices rising |
> | Entertainment | ₪800 | ₪600 | Consistently under by >30% |

After approval, update `budget.toml` in the config directory. Update the `updated` date in `[targets.meta]`.

## Step 8: Summary

> **$CURRENT Review Complete**
>
> | Metric | Value |
> |--------|-------|
> | Total spending | ₪X (vs ₪Y last month) |
> | Savings rate | X% (target: Y%) |
> | Targets met | X of Y |
> | Grade | 🟢/🟠/🔴 |
> | Key win | [one line] |
> | Key focus | [one line] |
>
> **Next review:** Run `/kolshek:review` after the 10th of next month, once all CC charges have posted.
