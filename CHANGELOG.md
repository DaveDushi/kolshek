# Changelog

## v0.3.5

### Security

- **Migrated credential storage to Bun.secrets**: Replaced platform-specific subprocess wrappers (PowerShell+advapi32, macOS `security` CLI, Linux `secret-tool`) with Bun's native `Bun.secrets` API. Eliminates credential exposure in process listings and removes the PowerShell script injection surface.
- **Input validation on credential aliases**: All credential storage functions now validate provider aliases against prototype pollution (`__proto__`, `constructor`), path traversal, and special character injection.
- **Atomic credential file writes**: Encrypted credential files now use write-to-temp + rename to prevent corruption on crash or power loss.
- **Windows permission hardening**: Credential files now get explicit owner-only ACLs via `icacls` (not just the parent directory). Permission failures are always logged instead of silently swallowed.
- **Keychain probe caching**: The OS keychain availability check is cached after the first call, avoiding repeated probe writes that could leave residual entries on process interruption.
- **Payload size limits**: Credential payloads larger than 64KB are rejected before parsing to prevent resource exhaustion.
- **Security test suite**: Added 47 unit tests covering alias validation, AES-256-GCM encrypt/decrypt roundtrips, tamper detection, error sanitization, and environment variable credential parsing.

---

## v0.3.4

### Features

- **Self-update command**: New `kolshek update` command downloads and installs the latest release binary directly from GitHub. Use `--check` to check for updates without installing.

---

## v0.3.3

### Bug Fixes

- **macOS keychain credentials not readable after save**: Fixed `providers add` saving credentials that couldn't be read back on macOS. The `security` CLI was prompting interactively ("retype password") even with piped stdin, causing silent storage failures. Now passes password as `-w` argument with `-U` flag for reliable atomic updates.

### Other

- **Landing site**: Switched hosting from GitHub Pages to Cloudflare Pages
- **Landing site**: Added BETA badge, live download counter, docs page, provider logos, and plugin picker

---

## v0.3.2

### Features

- **Web settings dashboard**: New `kolshek dashboard` command launches an HTMX-powered browser UI for managing providers, categories, and translations — with real-time fetch progress via SSE
- **Custom Tailwind v4 design system**: Dashboard uses a custom indigo/zinc design system with dark mode, replacing the old Pico CSS dependency
- **Logo**: KolShek logo added to the dashboard navbar and browser favicon

### Security

- **Localhost-only binding**: Dashboard server binds to `localhost`, preventing LAN exposure
- **CSRF protection**: Origin header checked on all mutation requests; mismatches return 403
- **XSS prevention**: All user-controlled content (toasts, SSE events, form values) is HTML-escaped before rendering
- **Security headers**: `X-Content-Type-Options: nosniff` and `X-Frame-Options: DENY` on all responses
- **Type-safe rule validation**: Category rule conditions and match modes are properly validated server-side (removed `as any` casts)
- **SSE race condition fix**: Event listeners registered before replay to prevent missed events on slow connections
- **Server-side alias validation**: Provider aliases validated with `[a-zA-Z0-9_-]+` regex

### Other

- Added MIT license, security policy (`SECURITY.md`), and documentation site (`docs/`)
- Extracted shared utilities (`escapeLike`, `simpleHash`, `formatRelativeTime`) to reduce code duplication
- Wrapped `applyTranslationRules` in a database transaction for atomicity
- Updated agent definitions to standard format with triggering examples
- Removed dead `provider-table.ts` partial

---

## v0.3.1

### Features

- **Lifestyle spending mode**: New `spending --lifestyle` flag excludes user-defined financial mechanics (transfers, CC settlements) from spending reports. Manage exclusions with `spending exclude add/remove/list`.
- **Duplicate rule detection**: `categorize rule add` now blocks duplicate conditions — same category warns "already exists", different category warns "conflict, remove first".

### Bug Fixes

- **Mutating PRAGMAs bypassed query validation**: `PRAGMA journal_mode=DELETE` and other setter PRAGMAs were incorrectly allowed through the `query` command. Now blocks any PRAGMA with `=` assignment.
- **LIMIT appended to PRAGMA/VALUES queries**: The auto-appended `LIMIT 100` caused syntax errors on PRAGMA and VALUES queries which don't support LIMIT clauses.
- **Insights included excluded categories**: Large transaction and merchant detection in `insights` now respect the `spending_excludes` list.

### Other

- Plugin skills migrated to [Agent Skills](https://agentskills.io/specification) open standard.

---

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
