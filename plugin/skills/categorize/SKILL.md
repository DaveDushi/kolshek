---
name: categorize
description: >
  Analyze transactions and create auto-categorization rules for expenses and income.
  Use when: categorize, label, classify, tag transactions, set up spending categories,
  manage category rules, rename or merge categories, reassign transactions in KolShek.
---

# /kolshek:categorize

You are helping the user categorize their transactions. This covers both expenses (groceries, restaurants, bills) and income (salary, freelance, refunds).

## Before You Start

Read `references/cli-reference.md` for the complete command reference, DB schema, exit codes, and SQL patterns.

Run startup checks:
1. `kolshek providers list --json` — if empty, guide user to `kolshek providers add`.
2. `kolshek transactions list --limit 1 --json` — if empty, offer to fetch.
3. `kolshek query "SELECT MAX(completed_at) as last_sync FROM sync_log WHERE status = 'success'" --json` — if over 24h old, suggest `kolshek fetch`.

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

The `rule add` command supports rich conditions beyond simple `--match`:
- `--match-exact <pattern>` — exact description match
- `--match-regex <pattern>` — regex match
- `--memo <pattern>` — match on memo field
- `--account <alias:number>` — account-specific rule
- `--amount <n>` / `--amount-min <n>` / `--amount-max <n>` — amount matching
- `--direction <debit|credit>` — direction filter
- `--priority <n>` — higher priority rules are evaluated first (default: 0)
Use richer conditions when simple substring matching would be too broad (e.g., exact match for a common word, amount match for rent).

Then apply all rules:
```
kolshek categorize apply --json
```

Other apply options:
- `kolshek categorize apply --all --json` — re-apply rules to ALL transactions (not just uncategorized)
- `kolshek categorize apply --from-category "OldName" --json` — re-apply only to a specific category

Report how many transactions were categorized (expenses and income separately).

## Step 5: Post-Categorization Tools

After initial categorization, the user may want to clean up:

- **Rename/merge:** `kolshek categorize rename "Old Name" "New Name" --json` — renames a category everywhere (transactions + rules)
- **Bulk migrate:** `kolshek categorize migrate --file mapping.json --json` — rename many categories at once from a `{"Old":"New"}` mapping
- **Reassign:** `kolshek categorize reassign --match "pattern" --to "Category" --json` — force-move transactions by description pattern
- **Bulk import:** `kolshek categorize rule import rules.json --json` — import rules from a JSON file (deduplicates automatically)

All support `--dry-run` to preview changes before applying.

## Step 6: Done

> Categorized N transactions (X expenses, Y income).
> You now have Z category rules. Add more anytime with `kolshek categorize rule add <category> --match <pattern>`.
