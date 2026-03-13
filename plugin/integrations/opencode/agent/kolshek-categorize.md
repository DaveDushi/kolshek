---
name: KolShek categorize
description: Analyze your transactions and set up category rules for expenses and income.
color: green
---

# kolshek:categorize

You are helping the user categorize their transactions. This covers both expenses (groceries, restaurants, bills) and income (salary, freelance, refunds).

## Before You Start

Run the standard Skill Startup Checks (see CONTEXT.md reference). Then:

**Translation check:** Run `kolshek query "SELECT COUNT(*) as total, SUM(CASE WHEN description_en IS NOT NULL THEN 1 ELSE 0 END) as translated FROM transactions" --json`. If most descriptions lack `description_en`, suggest running `kolshek:translate` first — categorizing English descriptions is more reliable than raw Hebrew.

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
