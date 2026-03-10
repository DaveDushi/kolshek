---
name: kolshek_setup
description: Set up KolShek — check CLI installation, verify providers are connected, fetch transactions, set up translations and categorization.
version: 0.1.0
metadata:
  { "openclaw": { "emoji": "⚙️", "requires": { "bins": ["kolshek"] } } }
---

# /kolshek_setup

You are running the KolShek setup flow. Your job is to get the user's financial data flowing — providers verified, transactions fetched, translated, and categorized.

## Step 1: Check CLI

Run `kolshek --version` to verify the CLI is installed. If not found:

> KolShek CLI not found. Download it from: https://github.com/DaveDushi/kolshek/releases
> Then run `/kolshek_setup` again.

Stop here if not installed.

## Step 2: Check Providers

Run `kolshek providers list --json`.

The response includes an `authenticated` field per provider and an `alias` field (providers can have multiple instances of the same bank/card with different aliases, e.g., `leumi-personal`, `leumi-joint`).

**If no providers:**

> Your bank/credit card credentials are sensitive. KolShek stores them securely in your OS keychain — they never touch disk or logs.
>
> Please run this in your terminal:
> ```
> kolshek providers add
> ```
> You can add multiple providers — the wizard will ask if you want to add more after each one.
> Let me know when you're done.

Wait for the user to confirm. Run `kolshek providers list --json` again to verify. If still none, repeat.

**If providers exist:**

Show what's connected (name, alias, auth status). If any show `authenticated: false`:

> Some providers need re-authentication. Run `kolshek providers auth <id>` in your terminal to update credentials.

Ask if they want to add more before continuing.

**Do NOT run `kolshek providers add`, `kolshek providers auth`, or `kolshek init` yourself.** These are interactive wizards — the user must run them in their own terminal.

## Step 3: Fetch Transactions

Run `kolshek transactions list --limit 1 --json` to check for existing data.

**If no transactions yet:**

> Fetching your transaction history. Each provider has its own max range (typically up to a year). This may take a few minutes...

Run: `kolshek fetch --json`

Handle exit codes:
- **0:** Report success — transactions fetched, date range per provider.
- **3:** Credentials expired — tell user to run `kolshek providers auth <id>` in their terminal, then retry.
- **4:** Timeout — retry with `--from 180d`, then `--from 90d`.
- **5:** Bank blocking — inform user, suggest trying later.
- **10:** Partial success — report what worked and what failed. Offer to retry failed providers individually (e.g., `kolshek fetch leumi-joint --json`).

**If transactions already exist**, show a quick count and date range, then ask if they want to fetch fresh data.

## Step 4: Translations

Many Israeli transaction descriptions are in Hebrew. Ask the user if they'd like English translations.

If yes:

1. Seed the built-in dictionary: `kolshek translate seed --json`.
2. Get unique untranslated descriptions: `kolshek query "SELECT DISTINCT description FROM transactions WHERE description IS NOT NULL AND description_en IS NULL ORDER BY description" --json`.
3. Cross-reference with existing rules: `kolshek translate rule list --json`.
4. For uncovered descriptions, generate English translations (you can read Hebrew). Present as a table:

> | Hebrew | English |
> |--------|---------|
> | שופרסל דיל | Shufersal Deal (supermarket) |
> | קפה גרג | Cafe Greg |
> | ... | ... |
>
> Look good? You can suggest changes or approve.

5. For each approved translation: `kolshek translate rule add "<english>" --match "<hebrew>" --json`.
6. Apply all rules: `kolshek translate apply --json`.
7. Report how many transactions were translated.

Tell them they can run `/kolshek_translate` anytime for new merchants.

## Step 5: Categorization

Ask the user if they want to categorize their transactions (both expenses and income).

If yes:

1. Get unique uncategorized descriptions, split by direction:
   - Expenses: `kolshek query "SELECT description, COUNT(*) as count, SUM(charged_amount) as total FROM transactions WHERE charged_amount < 0 AND category IS NULL GROUP BY description ORDER BY count DESC" --json`
   - Income: `kolshek query "SELECT description, COUNT(*) as count, SUM(charged_amount) as total FROM transactions WHERE charged_amount > 0 AND category IS NULL GROUP BY description ORDER BY count DESC" --json`

2. Generate category suggestions. Present as two tables:

> **Expenses:**
>
> | Description | Occurrences | Category |
> |-------------|-------------|----------|
> | Shufersal Deal | 12 | Groceries |
> | Wolt | 8 | Restaurants |
> | ... | ... | ... |
>
> **Income:**
>
> | Description | Occurrences | Category |
> |-------------|-------------|----------|
> | Salary - Acme Corp | 3 | Salary |
> | Bit Transfer | 5 | Transfers |
> | ... | ... | ... |
>
> Look good? You can suggest changes or approve.

3. For each approved rule: `kolshek categorize rule add <category> --match <pattern> --json`.
4. Apply all rules: `kolshek categorize apply --json`.
5. Report how many transactions were categorized.

Tell them they can run `/kolshek_categorize` anytime for new merchants.

## Step 6: Schedule Auto-Fetch

Ask the user if they want automatic transaction fetching:
- **Every 12 hours** — keeps data fresh throughout the day
- **Every 24 hours** — once a day
- **Skip** — manual fetching

If they choose a schedule: `kolshek schedule set --every <interval> --json`.

## Step 7: Summary

Run `kolshek providers list --json` and `kolshek accounts --json`.

> **Setup complete!**
>
> - **Providers:** N connected (Bank Hapoalim, Isracard, ...)
> - **Accounts:** N accounts
> - **Transactions:** N total (earliest: YYYY-MM-DD)
> - **Translations:** N rules applied / skipped
> - **Categories:** N rules applied / skipped
> - **Auto-fetch:** every Xh / not scheduled
>
> Just ask me anything about your finances — spending breakdowns, budget tracking, merchant analysis, or custom queries.
