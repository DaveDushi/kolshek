---
name: categorize
disable-model-invocation: true
allowed-tools: Bash, Read, AskUserQuestion
description: Analyze your transactions and set up category rules for expenses and income.
---

# /kolshek:categorize

You are helping the user categorize their transactions. This covers both expenses (groceries, restaurants, bills) and income (salary, freelance, refunds).

## Before You Start

Run the standard Skill Startup Checks (see CONTEXT.md reference). Then:

**Translation check:** Run `kolshek query "SELECT COUNT(*) as total, SUM(CASE WHEN description_en IS NOT NULL THEN 1 ELSE 0 END) as translated FROM transactions" --json`. If most descriptions lack `description_en`, suggest running `/kolshek:translate` first — categorizing English descriptions is more reliable than raw Hebrew.

## Step 1: Show Current State

Run `kolshek categorize list --json` to see existing categories and how many transactions are in each.

Run `kolshek categorize rule list --json` to see existing rules.

Report:

> You have N transactions total. X are categorized, Y are uncategorized.
> Existing rules: [list them, or "none"]

## Step 2: Analyze Uncategorized Transactions

Get all unique uncategorized descriptions, split by direction:

**Expenses:**
```
kolshek query "SELECT description, COUNT(*) as count, SUM(charged_amount) as total FROM transactions WHERE charged_amount < 0 AND (category IS NULL OR category = '') GROUP BY description ORDER BY count DESC" --json
```

**Income:**
```
kolshek query "SELECT description, COUNT(*) as count, SUM(charged_amount) as total FROM transactions WHERE charged_amount > 0 AND (category IS NULL OR category = '') GROUP BY description ORDER BY count DESC" --json
```

### CC Billing Detection

If the user has both bank and credit card providers, look for uncategorized bank transactions whose descriptions match credit card company names. These are CC billing charges — the monthly bank debit that pays the CC bill. They are internal transfers, not real expenses, and cause double-counting since the CC provider already tracks individual purchases.

Suggest to the user that these transactions be categorized as `"CC Billing"` (exact string) — but let the user decide. Reports automatically exclude `"CC Billing"` from expense totals.

## Step 3: Suggest Categories

Generate category suggestions for both expenses and income. Present as two tables:

> **Expenses:**
>
> | Description | Occurrences | Suggested Category |
> |-------------|-------------|-------------------|
> | Shufersal Deal | 12 | Groceries |
> | Wolt | 8 | Restaurants |
> | Cellcom | 3 | Utilities |
> | ... | ... | ... |
>
> **Income:**
>
> | Description | Occurrences | Suggested Category |
> |-------------|-------------|-------------------|
> | Salary - Acme Corp | 3 | Salary |
> | Bit Transfer | 5 | Transfers |
> | Tax Refund | 1 | Refunds |
> | ... | ... | ... |
>
> Look good? You can suggest changes, remove entries, or approve.

## Step 4: Apply

Let the user review — they can approve all, request changes to specific ones, or skip entries.

For each approved rule:
```
kolshek categorize rule add <category> --match <pattern> --json
```

Then apply all rules:
```
kolshek categorize apply --json
```

Report how many transactions were categorized (expenses and income separately).

## Step 5: Done

> Categorized N transactions (X expenses, Y income).
> You now have Z category rules. Add more anytime with `kolshek categorize rule add <category> --match <pattern>`.
