---
name: categorize
description: Analyze transactions and create auto-categorization rules for expenses and income. Use when user asks to categorize, label, classify, or tag transactions, set up spending categories, manage category rules, rename or merge categories, or reassign transactions in KolShek.
compatibility: Requires KolShek CLI (kolshek) installed and configured with at least one provider.
metadata:
  author: kolshek
  version: "0.4.5"
allowed-tools: Bash Read AskUserQuestion
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

### Internal Transfers & CC Billing Detection

Run `kolshek providers list --json` to get connected providers.

**CC billing charges:** For each connected credit card provider (e.g., Max, Isracard, Cal/Visa Cal, Amex), look for uncategorized bank transactions whose descriptions match that CC company name. These are the monthly bank debit that pays the CC bill — internal transfers, not real expenses. Including them double-counts spending since the CC provider already tracks individual purchases. Suggest categorizing these and setting their classification to `cc_billing` in Step 5.

**Inter-bank transfers:** If the user has multiple bank providers connected (e.g., Leumi and Hapoalim), look for transactions in one bank that reference the other bank's name. These are transfers between the user's own accounts — not income or expenses. Suggest categorizing these and setting their classification to `transfer` in Step 5.

**Other non-spending:** Also look for investment deposits, loan payments, or savings transfers — these should get appropriate classifications (`investment`, `debt`, `savings`) so they don't pollute spending reports.

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

## Step 5: Set Classifications

Every category has a **classification** that tells reports how to treat it. The built-in classifications are: `expense`, `income`, `cc_billing`, `transfer`, `investment`, `debt`, `savings`. New categories default to `expense` or `income` based on transaction direction.

First, check current classifications:
```
kolshek categorize classify list --json
```

Auto-classify based on dominant transaction direction (>80% debit → expense, >80% credit → income):
```
kolshek categorize classify auto --dry-run --json
```

If the preview looks good, apply:
```
kolshek categorize classify auto --json
```

For categories that need special treatment (CC billing, transfers, investments), set them manually:
```
kolshek categorize classify set "CC Billing" cc_billing --json
kolshek categorize classify set "Bank Transfer" transfer --json
kolshek categorize classify set "Savings Deposit" savings --json
```

Present the final classification map to the user. Reports use `--exclude` and `--include` flags on classifications — for example, `kolshek spending 2026-03 --exclude cc_billing,transfer` excludes those categories from spending totals. Sensible defaults are applied automatically (spending excludes `cc_billing`, `transfer`, and `income` by default).

## Step 6: Post-Categorization Tools

After initial categorization, the user may want to clean up:

- **Rename/merge:** `kolshek categorize rename "Old Name" "New Name" --json` — renames a category everywhere (transactions + rules)
- **Bulk migrate:** `kolshek categorize migrate --file mapping.json --json` — rename many categories at once from a `{"Old":"New"}` mapping
- **Reassign:** `kolshek categorize reassign --match "pattern" --to "Category" --json` — force-move transactions by description pattern
- **Bulk import:** `kolshek categorize rule import rules.json --json` — import rules from a JSON file (deduplicates automatically)

All support `--dry-run` to preview changes before applying.

## Step 7: Done

> Categorized N transactions (X expenses, Y income).
> You now have Z category rules. Add more anytime with `kolshek categorize rule add <category> --match <pattern>`.
> Classifications set for N categories. Reports automatically exclude non-expense classifications from spending totals.
