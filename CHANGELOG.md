# Changelog

## v0.3.9

### Bug Fixes

- **Dashboard port collision**: Changed default dashboard port from 3000 to 45091 to avoid cookie collisions with other local dev servers (React, Express, Rails, etc.).

### Other

- Streamlined installation with one-liner scripts for Windows, macOS, and Linux.
- Added SHA256 checksum generation to release workflow.

---

## v0.3.8

### Features

- **Transaction pagination**: Dashboard transaction table now supports server-side pagination with configurable page sizes (25/50/100), page number navigation with ellipsis, and scroll-to-top on page change.
- **Provider credential update**: New dialog in the dashboard to update login credentials for existing providers without re-adding them.
- **Per-provider sync**: Sync individual providers from the dashboard provider card menu instead of syncing all at once.
- **Sync queue**: Multiple sync requests are queued and processed sequentially with deduplication and a max queue depth of 10.
- **4-state auth status**: Providers now show one of four authentication states (no credentials, pending, connected, expired) based on credential and sync history.
- **CLI update check**: Non-blocking version check with 24-hour cache notifies users when a new release is available.
- **Getting started flow**: New setup page with separate tabs for agent-assisted and manual configuration paths.
- **Mobile dashboard navigation**: Responsive page navigation and labels for mobile screens.

### Security

- **Timing-safe token comparison**: Session token validation now uses `crypto.timingSafeEqual` to prevent timing attacks.
- **Single-use URL token**: The dashboard launch token in the URL is consumed on first use — replay from browser history is rejected.
- **Dev-mode isolation**: `.dev-session` file and Vite CORS origins are now gated behind `KOLSHEK_DEV=1` environment variable, with automatic cleanup on exit.
- **Secure cookie flag**: Session cookie now includes the `Secure` attribute.
- **Self-update integrity**: Binary downloads are verified against SHA256 checksum sidecar files. Downloads abort on checksum mismatch or verification failure. HTTPS is enforced.
- **XSS fix**: Site feedback form now uses DOM API with GitHub URL allowlist instead of `innerHTML`.
- **Enhanced error sanitization**: Credential-like values in JSON format (`"password":"value"`) are now redacted in error responses, with an expanded keyword list.
- **Provider ID validation**: Sync endpoint validates and coerces provider IDs to positive numbers, rejecting invalid input.
- **SPA fallback hardening**: Security headers (CSP, X-Frame-Options, etc.) now applied to the SPA index.html fallback response.
- **Update check timeout**: Background GitHub API check aborts after 5 seconds to prevent connection leaks.

### Bug Fixes

- **Sync error visibility**: Error messages are now shown when individual providers fail during sync.
- **Auth status threshold**: Providers require 2+ consecutive sync failures before showing "expired" status — a single transient failure no longer triggers a false alarm.
- **Sync queue dedup**: Duplicate provider sync requests are deduplicated in the queue, and empty provider arrays are normalized.
- **React performance**: Fixed `useCallback` dependency on unstable mutation object in credential update dialog.
- **Dead code cleanup**: Removed unused `isSyncing` prop from provider grid components.

### Other

- Security and liability disclaimer added to documentation.
- Documentation synced with codebase.

---

## v0.3.7

### Features

- **React dashboard with client-side routing**: Full SPA dashboard with 8 pages — overview, transactions, spending, trends, insights, categories, translations, and providers. Includes live sync progress panel, per-provider status tracking, and theme switching.
- **Classification-based filtering**: Transactions are now classified (expense, income, transfer, cc_billing, etc.) with filtering support across all report and trend endpoints.
- **Custom classifications**: Users can create and assign custom classifications beyond the built-in set via the dashboard classification panel.
- **Real-time sync streaming**: Bank sync now streams per-provider SSE events (start → progress → result → done) with live reconnection support for late-joining clients.

### Security

- **Session authentication**: Dashboard requires a cryptographic token (generated at launch, exchanged for an HttpOnly/SameSite=Strict cookie) — no more open endpoints.
- **CORS hardening**: Replaced wildcard `Access-Control-Allow-Origin: *` with an explicit origin allowlist and exact-match validation.
- **CSRF protection**: All mutations reject requests with missing or non-allowlisted `Origin` headers.
- **Path traversal prevention**: Static file serving validates resolved paths stay within the build output directory.
- **Content-Security-Policy**: Added CSP header restricting scripts, styles, images, and connections to same-origin only.
- **ReDoS prevention**: User-supplied regex patterns are validated for length, nested quantifiers, and excessive alternation before compilation.
- **Error sanitization**: All API and SSE error responses strip file paths, stack traces, and internal details.
- **Pagination limits**: Transaction endpoints capped at 500 rows per request to prevent database dumps.
- **Windows permission fix**: Switched from Node's `child_process.spawnSync` to `Bun.spawnSync` for reliable `icacls` permission hardening.

### Bug Fixes

- **Fixed sync endpoint mismatch**: Client and server now agree on `/api/v2/fetch` route and SSE event types (`start`, `progress`, `result`, `done`).
- **Fixed SSE reconnection**: `GET /api/v2/fetch/events` now streams live events instead of returning a dead snapshot.
- **Fixed Vite dev server auth**: Added `credentials: "include"` on client and `Access-Control-Allow-Credentials` on server for cross-origin cookie support.
- **Fixed duplicate favicon route**: Removed dead code branch for `/favicon.png` that shadowed the `/favicon.ico` handler.

### Other

- **Removed legacy HTMX partials**: Deleted all server-rendered HTML templates, styles, and layout files (~1,500 lines) in favor of the React SPA.
- **Site polish**: Updated favicon, added GitHub stars badge, footer credits, and improved nav/chat/theme toggle on the docs site.

---

## v0.3.6

### Features

- **Multi-agent plugin rewrite**: Consolidated plugin system from 7+ tool-specific integration folders into a single canonical source. Skills now install from one source to Claude Code, OpenCode, Codex, and OpenClaw.
- **New skills — analyze and review** (by Adir): `/kolshek:analyze` for deep-dive financial analysis with budget targets, and `/kolshek:review` for monthly spending reviews with progress report cards.
- **CLI reference documentation**: Added complete CLI reference to plugin skills covering all commands, global flags, command aliases, exit codes, DB schema, and SQL patterns.

### Bug Fixes

- **Fixed init wizard offering unsupported AI tools**: Removed dead tool options (Cursor, Gemini CLI, Windsurf, Aider) and added missing ones (OpenCode, Codex) to match supported tools.
- **Fixed Codex skill install path**: Skills now install to `~/.codex/skills/` instead of the incorrect `.agents/skills/`.
- **Fixed OpenClaw skill install path**: Skills now install to `~/.openclaw/workspace/skills/` instead of the incorrect `.agents/skills/`.
- **Fixed `--type` flag documentation**: Corrected `--type <bank|card>` to `--type <bank|credit_card>` to match actual CLI.
- **Removed dead `/kolshek:budget-app` references**: Replaced all references to the removed skill in init workflow and check-config hook.
- **Fixed `/dev/null` usage in check-config hook**: Replaced with variable capture for Windows compatibility.

### Other

- **Standardized skill frontmatter**: All 5 skills now have consistent `allowed-tools`, `compatibility`, and `metadata` fields.
- **Added missing commands to CLI reference**: Documented `dashboard`, `update`, and `plugin` commands, plus `--visible` and `-m, --month-offset` flags.
- **Added release step for plugin bundle regeneration**: Release command now regenerates embedded plugin files before committing.

---

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
