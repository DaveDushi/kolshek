## v0.3.0

### Features

- **Spending command**: New `spending [month]` command with grouping by category, merchant, or provider, percentage breakdown, and daily average.
- **Income command**: New `income [month]` command with salary detection, transfer classification, and bank/CC refund separation.
- **Trends command**: New `trends` command showing month-over-month spending and income trends with configurable lookback period.
- **Insights command**: New `insights` command with automated financial alerts — detects category spikes, large transactions, new merchants, recurring charge changes, and negative cashflow trends.
- **Shorthand category import schemas**: `categorize rule import` now accepts both legacy `{matchPattern}` and new `{conditions}` formats, with improved validation errors.

### Bug Fixes

- **Broken merchant insights**: Fixed snake_case→camelCase mapping bug that caused `detectNewMerchants` and `detectRecurringChanges` to silently return empty results.
- **Wrong merchant average calculation**: Merchant history now computes per-month averages (via CTE) instead of per-transaction averages, preventing false spike alerts.
- **Missing transfer classification**: `classifyIncome` now detects bank transfers (העברה, transfer) instead of lumping them into "other".
- **Silent invalid month fallback**: `spending foobar` and `income foobar` now exit with a clear error instead of silently defaulting to the current month.
- **Insights NaN crash**: `insights --months abc` no longer crashes with an unhandled `RangeError`; validates input and exits with a clear message.
- **Identical alert/warning icons**: Alerts now display `[!!]` vs warnings `[!]` in no-color mode for visual distinction.
- **Redundant SQL in cashflow query**: Simplified `getMonthCashflow` net calculation by removing a tautological `CASE WHEN`.
- **JSDoc blocks in date-utils**: Converted to line comments for Bun 1.3.2 parser compatibility.

### Other

- Added error handling with actionable suggestions to `income` and `insights` commands for DB failures.

---

## v0.2.0

### Features

- **Multi-field category rule engine**: Category rules now support matching on multiple transaction fields (description, memo, amount, etc.) with AND logic, regex/substring/exact modes, and priority ordering. Replaces the old single-pattern rules (auto-migrated on upgrade).
- **Recategorize and reassign commands**: New `categorize reassign` applies updated rules to existing transactions, and `categorize recategorize` lets you re-run categorization interactively.
- **Category bulk import, migration, and rename**: New CLI commands for importing rules from stdin/file, migrating rule formats, and renaming categories across all transactions and rules.
- **CC billing charge handling**: Reports now detect and flag credit card billing lines in bank statements to prevent double-counting expenses.
- **stdin support for rule import**: Pipe rules directly into `categorize rule import` from other tools or scripts.

### Bug Fixes

- **Shell quoting with special characters**: Fixed quoting bugs when merchant names contain characters that break shell parsing.
- **Remove seed translations/rules**: Seed data no longer auto-inserted — users define their own rules from scratch.

### Security

- **Windows file permission hardening**: Database and config directories now use `icacls` ACLs on Windows (where `chmod` is a no-op) to restrict access to the current user only.
- **Credential zeroing**: Bank credentials are now zeroed from memory after use in all provider commands (`add`, `auth`, `test`, `init`).
- **Read-only PRAGMA whitelist**: The `query` command now restricts PRAGMAs to a safe read-only set, blocking mutating PRAGMAs like `journal_mode=DELETE`.
- **SQL injection guard on schema introspection**: Added regex validation on table names in `db schema` to harden the PRAGMA interpolation.
- **Pinned scraper dependency**: `israeli-bank-scrapers-core` pinned to exact version `6.7.1` to mitigate supply chain risk.

### Other

- **Added README** with usage examples, architecture overview, and contribution guide.
