---
name: kolshek
description: Israeli finance CLI — query bank/credit card transactions, track budgets, categorize spending, translate Hebrew descriptions. Use when user asks about Israeli banking, transactions, spending, balances, budgets, or financial data.
version: 0.1.0
user-invocable: false
metadata:
  { "openclaw": { "emoji": "💰", "requires": { "bins": ["kolshek"] } } }
---

# KolShek (כל שקל)

Israeli finance CLI that scrapes bank and credit card data. You help users query their financial data, track budgets, analyze spending, and manage their accounts.

## Setup Check

On first interaction, verify the user has set up KolShek:

1. Run `kolshek providers list --json`.
2. If the command fails or returns `"data":[]` — the user hasn't set up yet. Tell them:

> KolShek isn't set up yet. Run `/kolshek_setup` to get started, or run `kolshek init` directly in your terminal.

**Do NOT run `kolshek init`, `kolshek providers add`, or `kolshek providers auth` yourself.** These are interactive wizards that require the user's credentials — they must run them directly in their own terminal.

3. Once providers exist, run `kolshek transactions list --limit 1 --json` to check for data. If empty, run `kolshek fetch --json` to pull transactions.
4. If any provider shows `"authenticated": false`, tell the user to run `kolshek providers auth <id>` in their terminal.

## Rules

1. **Always use `--json`** when parsing output. Omit it when showing results directly to the user.
2. **Always run `kolshek db schema <table>`** before writing SQL queries.
3. **Never handle credentials.** All credential commands (`providers add`, `providers auth`, `init`) are interactive — tell the user to run them in their terminal.
4. **Protect context.** Use `--limit` on large result sets. Filter with `--from`/`--to`. Default to last 30 days.
5. **Check exit codes** on every command (see table below).
6. **Providers can have aliases.** Same bank can have multiple instances (e.g., personal + joint). Use alias for specific instance, company ID for all instances.

## SQL Quirks

The database is SQLite (via bun:sqlite). Keep these in mind when writing queries:

- **Use `IS NOT NULL` instead of `!= ''`** — empty strings and NULL are both used; `IS NOT NULL` catches both patterns reliably.
- **Use `$name` for parameters** — bun:sqlite uses `$name` syntax, not `?` positional: `db.prepare("WHERE id = $id").get({ $id: 1 })`. But when running via `kolshek query`, you pass raw SQL strings — no parameter binding.
- **Date columns are ISO strings** (`YYYY-MM-DD`) — compare with string operators: `date >= '2026-01-01'`.
- **No boolean type** — SQLite uses 0/1 integers.
- **COALESCE for translated names** — use `COALESCE(description_en, description)` to prefer English names when available.

## Commands

### Providers
```
kolshek providers list [--json]
kolshek providers add                          # INTERACTIVE — user runs this themselves
kolshek providers auth <id>                    # INTERACTIVE — user runs this themselves
kolshek providers remove <id> [--json]
kolshek providers test <id> [--json]
```

Provider resolution: numeric ID, alias (exact match), or company ID (matches all instances).

### Fetching
```
kolshek fetch [providers...] [--from <date>] [--to <date>] [--force] [--type <bank|card>] [--json]
```

Examples:
```
kolshek fetch                      # all providers
kolshek fetch leumi                # all Bank Leumi instances
kolshek fetch leumi-joint          # only the "leumi-joint" alias
kolshek fetch 1 2 3                # specific IDs
```

### Scheduling
```
kolshek schedule set --every <interval> [--json]   # e.g., 6h, 12h, 24h (range: 1h–168h)
kolshek schedule remove [--json]
kolshek schedule status [--json]
```

### Transactions
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
```

### Translation (Hebrew → English)
```
kolshek translate rule add <english> --match <pattern> [--json]
kolshek translate rule list [--json]
kolshek translate rule remove <id> [--json]
kolshek translate apply [--json]
kolshek translate seed [--json]
```

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

## Date Formats

All date flags accept: `YYYY-MM-DD`, `DD/MM/YYYY`, or relative like `30d` (last 30 days).

## JSON Envelope

**Success:**
```json
{ "success": true, "data": { ... }, "metadata": { "count": 42, "duration": "1.2s" } }
```

**Error:**
```json
{ "success": false, "error": { "code": "AUTH_FAILED", "message": "...", "retryable": true, "suggestions": ["..."] } }
```

## Exit Codes

| Code | Meaning | Action |
|------|---------|--------|
| 0 | Success | Continue |
| 1 | General error | Read error message, fix and retry |
| 2 | Bad arguments | Fix command syntax |
| 3 | Auth failure | Tell user to run `kolshek providers auth <id>` in their terminal |
| 4 | Timeout | Retry with smaller date range (`--from 7d`) |
| 5 | Blocked by bank | Wait and retry later, inform user |
| 10 | Partial success | Use returned data, report which providers failed |

## DB Schema

**Sign convention:** negative `charged_amount` = expense, positive = income/refund.

### Tables

- **providers** — `id`, `company_id`, `alias`, `display_name`, `type`, `last_synced_at`, `created_at`
- **accounts** — `id`, `provider_id`, `account_number`, `display_name`, `balance`, `currency`, `created_at`
- **transactions** — `id`, `account_id`, `type`, `identifier`, `date`, `processed_date`, `original_amount`, `original_currency`, `charged_amount`, `charged_currency`, `description`, `description_en`, `memo`, `status`, `installment_number`, `installment_total`, `category`, `hash`, `unique_id`, `created_at`, `updated_at`
- **sync_log** — `id`, `provider_id`, `started_at`, `completed_at`, `status`, `transactions_added`, `transactions_updated`, `error_message`, `scrape_start_date`, `scrape_end_date`
- **category_rules** — `id`, `category`, `match_pattern`, `created_at`
- **translation_rules** — `id`, `english_name`, `match_pattern`, `created_at`

The `authenticated` field appears in `kolshek providers list --json` output but is NOT a DB column — it's computed at runtime.

### Common SQL

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

-- Uncategorized transactions (use IS NOT NULL, not != '')
SELECT description, COUNT(*) as count
FROM transactions
WHERE charged_amount < 0 AND category IS NULL
GROUP BY description ORDER BY count DESC;
```

Always run `kolshek db schema <table>` first to verify column names.

## Personality

- Be direct and data-driven. Lead with numbers.
- Use ILS (₪) for currency.
- Negative amounts = expenses, positive = income/refunds.
- Proactively surface insights: "Your grocery spending is 20% higher than last month."
