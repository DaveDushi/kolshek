---
name: kolshek_categorize
description: Analyze your transactions and set up category rules for expenses and income.
version: 0.1.0
metadata:
  { "openclaw": { "emoji": "🏷️", "requires": { "bins": ["kolshek"] } } }
---

# /kolshek_categorize

You are helping the user categorize their transactions. This covers both expenses (groceries, restaurants, bills) and income (salary, freelance, refunds).

## Before You Start

1. Run `kolshek providers list --json` — if no providers, tell the user to run `kolshek providers add` in their terminal. Wait and re-check.
2. Run `kolshek transactions list --limit 1 --json` — if no transactions, offer to fetch: "No transaction data yet. Want me to fetch it now?" If yes, run `kolshek fetch --json`.

## Step 1: Show Current State

Run `kolshek categorize list --json` to see existing categories and counts.

Run `kolshek categorize rule list --json` to see existing rules.

Report:

> You have N transactions total. X are categorized, Y are uncategorized.
> Existing rules: [list them, or "none"]

## Step 2: Analyze Uncategorized Transactions

Get unique uncategorized descriptions, split by direction:

**Expenses:**
```
kolshek query "SELECT description, COUNT(*) as count, SUM(charged_amount) as total FROM transactions WHERE charged_amount < 0 AND category IS NULL GROUP BY description ORDER BY count DESC" --json
```

**Income:**
```
kolshek query "SELECT description, COUNT(*) as count, SUM(charged_amount) as total FROM transactions WHERE charged_amount > 0 AND category IS NULL GROUP BY description ORDER BY count DESC" --json
```

### CC Billing Detection

If the user has both bank and credit card providers, look for uncategorized bank transactions whose descriptions match credit card company names (e.g., "ויזה כאל", "כאל", "ישראכרט", "מקס", "אמריקן אקספרס", "visa cal"). These are **CC billing charges** — the monthly bank debit that pays the CC bill. They are internal transfers, not real expenses, and cause double-counting since the CC provider already tracks individual purchases.

Suggest categorizing these as `"CC Billing"` (exact string). Reports automatically exclude `"CC Billing"` from expense totals.

## Step 3: Suggest Categories

Generate category suggestions for both expenses and income. Present as two tables:

> **Expenses:**
>
> | Description | Occurrences | Suggested Category |
> |-------------|-------------|-------------------|
> | Shufersal Deal | 12 | Groceries |
> | Wolt | 8 | Restaurants |
> | Cellcom | 3 | Utilities |
>
> **Income:**
>
> | Description | Occurrences | Suggested Category |
> |-------------|-------------|-------------------|
> | Salary - Acme Corp | 3 | Salary |
> | Bit Transfer | 5 | Transfers |
>
> Look good? You can suggest changes, remove entries, or approve.

## Step 4: Apply

Let the user review — they can approve all, request changes, or skip entries.

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
> You now have Z category rules. Run `/kolshek_categorize` anytime to handle new merchants.
