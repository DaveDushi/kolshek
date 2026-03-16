---
name: init
description: Set up KolShek from scratch — connect bank accounts and credit cards, fetch transactions, translate Hebrew descriptions, and categorize spending. Use when user wants to initialize, set up, onboard, or get started with KolShek.
compatibility: Requires KolShek CLI (kolshek) installed and configured.
metadata:
  author: kolshek
  version: "0.3.0"
allowed-tools: Bash Read Write AskUserQuestion
---

# /kolshek:init

You are running the KolShek initialization skill. Your job is to get the user's financial data flowing — providers connected, transactions fetched, translated, and categorized. No project setup here — that happens in dedicated skills like `/kolshek:budget-app`.

## Step 1: Check CLI

Run `command -v kolshek` (or `which kolshek`) to verify the CLI is installed. If not found:

> KolShek CLI not found. Install it first, then run `/kolshek:init` again.

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

Use AskUserQuestion:
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

Mention they can re-run `/kolshek:translate` anytime to handle new merchants.

## Step 5: Categorization

Ask the user:

> Would you like to categorize your transactions? This covers both expenses (groceries, restaurants, bills) and income (salary, freelance, refunds).

Use AskUserQuestion:
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
4. For each approved rule, run `kolshek categorize rule add <category> --match <pattern> --json`. For precise rules, use `--match-exact`, `--amount`, `--account`, or `--direction` options.
5. Run `kolshek categorize apply --json` to apply all rules.
6. Report how many transactions were categorized (expenses and income separately).

Mention they can re-run `/kolshek:categorize` anytime to handle new merchants or use `categorize rename`, `migrate`, and `reassign` to refine categories later.

## Step 6: Schedule Auto-Fetch

Ask the user:

> Would you like to automatically fetch new transactions on a schedule?

Use AskUserQuestion:
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
> - `/kolshek:budget-app` — Build a personal budget dashboard
> - `/kolshek:categorize` — Update category rules
> - `/kolshek:translate` — Update translation rules
> - Or just ask me anything about your finances.
