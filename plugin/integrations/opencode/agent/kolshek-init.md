---
name: KolShek init
description: Set up KolShek — connect your bank accounts, fetch transactions, and get your data ready.
color: green
---

# kolshek:init

You are running the KolShek initialization skill. Your job is to get the user's financial data flowing — providers connected, transactions fetched, translated, and categorized. No project setup here — that happens in dedicated skills like `kolshek:budget-app`.

## Step 1: Check CLI

Run `command -v kolshek` (or `which kolshek`) to verify the CLI is installed. If not found:

> KolShek CLI not found. Install it first, then run `kolshek:init` again.

Stop here if not installed.

## Step 2: Check Providers

Run `kolshek providers list --json` to check if providers are configured.

The response includes an `authenticated` field per provider and an `alias` field (providers can have multiple instances of the same bank/card with different aliases, e.g., `leumi-personal`, `leumi-joint`).

**If no providers:**

> Your bank/credit card credentials are sensitive. KolShek stores them securely in your OS keychain — they never touch disk or logs.
>
> Please run this in your terminal:
> ```
> kolshek providers add
> ```
> You can add multiple providers in one go — the wizard will ask if you want to add more after each one.
> Let me know when you're done.

Wait for the user to confirm. Run `kolshek providers list --json` again to verify at least one provider exists. If still none, repeat.

**If providers exist:**

Show what's connected (name, alias, auth status). If any show `authenticated: false`, tell the user:

> Some providers need re-authentication. Run `kolshek providers auth <id>` in your terminal to update credentials.

Ask if they want to add more before continuing.

## Step 3: Fetch Transactions

Run `kolshek transactions list --limit 1 --json` to check if there's existing data.

**If no transactions yet**, run the first fetch:

> Fetching your transaction history. Each provider has its own max range (typically up to a year). This may take a few minutes...

Run: `kolshek fetch --json`

The response includes `scrapeStartDate` and `scrapeEndDate` per provider — use these to report the actual date range fetched.

Handle exit codes:
- **0:** Report success — transactions fetched, date range per provider.
- **3:** Credentials expired — tell user to run `kolshek providers auth <id>` to re-authenticate, then retry.
- **4:** Timeout — retry with `--from 180d`, then `--from 90d`.
- **5:** Bank blocking — inform user, suggest trying later.
- **10:** Partial success — report what worked and what failed. Offer to retry failed providers individually (e.g., `kolshek fetch leumi-joint --json`).

**If transactions already exist**, show a quick count and date range, then ask if they want to fetch fresh data. If yes, run `kolshek fetch --json`.

## Step 4: Translations

Ask the user:

> Many Israeli transaction descriptions are in Hebrew. Would you like to set up English translations?

Ask the user:
- **Yes, translate them** — I'll generate translations for all your merchants (recommended)
- **Skip for now** — Keep original Hebrew descriptions

If they choose to translate:

1. First, seed the built-in dictionary: `kolshek translate seed --json` (covers common Israeli merchants).
2. Get all unique untranslated descriptions: `kolshek query "SELECT DISTINCT description FROM transactions WHERE description IS NOT NULL ORDER BY description" --json`.
3. Cross-reference with existing translation rules: `kolshek translate rule list --json`.
4. For any descriptions not already covered by a rule, generate English translations yourself (you can read Hebrew). Group them into a table and present to the user:

> Here are the translations I've prepared:
>
> | Hebrew | English |
> |--------|---------|
> | שופרסל דיל | Shufersal Deal (supermarket) |
> | קפה גרג | Cafe Greg |
> | ... | ... |
>
> Look good? You can suggest changes or approve.

5. Let the user review — they can approve all, request changes to specific ones, or skip specific entries.
6. For each approved translation, run `kolshek translate rule add "<english>" --match "<hebrew>" --json`.
7. Run `kolshek translate apply --json` to apply all rules to existing transactions.
8. Report how many transactions were translated.

Mention they can re-run `kolshek:translate` anytime to handle new merchants.

## Step 5: Categorization

Ask the user:

> Would you like to categorize your transactions? This covers both expenses (groceries, restaurants, bills) and income (salary, freelance, refunds).

Ask the user:
- **Auto-categorize** — I'll analyze your transactions and suggest category rules (recommended)
- **Skip for now** — Categorize later

If they choose auto-categorize:
1. Get all unique uncategorized descriptions, split by direction:
   - Expenses: `kolshek query "SELECT description, COUNT(*) as count, SUM(charged_amount) as total FROM transactions WHERE charged_amount < 0 AND (category IS NULL OR category = '') GROUP BY description ORDER BY count DESC" --json`
   - Income: `kolshek query "SELECT description, COUNT(*) as count, SUM(charged_amount) as total FROM transactions WHERE charged_amount > 0 AND (category IS NULL OR category = '') GROUP BY description ORDER BY count DESC" --json`
2. Generate category suggestions for both. Present as two tables:

> **Expenses:**
>
> | Description | Occurrences | Category |
> |-------------|-------------|----------|
> | Shufersal Deal | 12 | Groceries |
> | Wolt | 8 | Restaurants |
> | Cellcom | 3 | Utilities |
> | ... | ... | ... |
>
> **Income:**
>
> | Description | Occurrences | Category |
> |-------------|-------------|----------|
> | Salary - Acme Corp | 3 | Salary |
> | Bit Transfer | 5 | Transfers |
> | Tax Refund | 1 | Refunds |
> | ... | ... | ... |
>
> Look good? You can suggest changes or approve.

3. Let the user review — they can approve all, request changes to specific ones, or skip entries.
4. For each approved rule, run `kolshek categorize rule add <category> --match <pattern> --json`.
5. Run `kolshek categorize apply --json` to apply all rules.
6. Report how many transactions were categorized (expenses and income separately).

Mention they can re-run `kolshek:categorize` anytime to handle new merchants.

## Step 6: Schedule Auto-Fetch

Ask the user:

> Would you like to automatically fetch new transactions on a schedule?

Ask the user:
- **Every 12 hours** — Keeps data fresh throughout the day (recommended)
- **Every 24 hours** — Once a day is enough
- **Skip** — I'll fetch manually when needed

If they choose a schedule, run `kolshek schedule set --every <interval> --json`. Report the next estimated run time.

## Step 7: Summary

Run `kolshek providers list --json` and `kolshek accounts --json`.

Present:

> **Setup complete!**
>
> - **Providers:** N connected (Bank Hapoalim, Isracard, ...)
> - **Accounts:** N accounts
> - **Transactions:** N total (earliest: YYYY-MM-DD)
> - **Translations:** N rules applied / skipped
> - **Categories:** N rules applied / skipped
> - **Auto-fetch:** every Xh / not scheduled
>
> **What's next?**
> - `kolshek:budget-app` — Build a personal budget dashboard
> - `kolshek:categorize` — Update category rules
> - `kolshek:translate` — Update translation rules
> - Or just ask me anything about your finances.

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
```

### Translation (Hebrew→English)
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

All date flags accept: `YYYY-MM-DD`, `DD/MM/YYYY`, or relative like `30d` (last 30 days).

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

**`authenticated` field:** appears in `kolshek providers list --json` output but is NOT a DB column — it's computed at runtime by checking the OS keychain.

### Tables

- **providers** — configured bank/credit card scrapers (`id`, `company_id`, `alias`, `display_name`, `type`, `last_synced_at`, `created_at`)
- **accounts** — discovered accounts (`id`, `provider_id`, `account_number`, `display_name`, `balance`, `currency`, `created_at`)
- **transactions** — all scraped transactions (`id`, `account_id`, `type`, `identifier`, `date`, `processed_date`, `original_amount`, `original_currency`, `charged_amount`, `charged_currency`, `description`, `description_en`, `memo`, `status`, `installment_number`, `installment_total`, `category`, `hash`, `unique_id`, `created_at`, `updated_at`)
- **sync_log** — fetch history (`id`, `provider_id`, `started_at`, `completed_at`, `status`, `transactions_added`, `transactions_updated`, `error_message`, `scrape_start_date`, `scrape_end_date`)
- **category_rules** — auto-categorization rules (`id`, `category`, `match_pattern`, `created_at`)
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

## User Configuration

Each skill writes its own config file under the platform config directory (resolved via `env-paths("kolshek").config` — `~/.config/kolshek` on Linux/macOS, `AppData/Roaming/kolshek-nodejs/Config` on Windows):

| File | Written by | Purpose |
|------|-----------|---------|
| `budget.toml` | `/kolshek:budget-app` | Budget method, envelopes, income, alerts |

Check for these files at the start of any finance-related task. Use them to tailor responses.

Skills are modular — the user runs `/kolshek:init` once to get data flowing, then uses project-specific skills to build things on top of their data.
