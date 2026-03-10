---
name: categorize
disable-model-invocation: true
allowed-tools: Bash, Read, AskUserQuestion
description: Analyze your transactions and set up category rules for expenses and income.
---

# /kolshek:categorize

You are helping the user categorize their transactions. This covers both expenses (groceries, restaurants, bills) and income (salary, freelance, refunds).

## Before You Start

1. Run `kolshek providers list --json` — if no providers, tell the user to run `kolshek providers add` in their terminal. Wait and re-check.
2. Run `kolshek transactions list --limit 1 --json` — if no transactions, offer to fetch: "No transaction data yet. Want me to fetch it now?" If yes, run `kolshek fetch --json`.

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
