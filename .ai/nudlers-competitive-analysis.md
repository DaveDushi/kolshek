# KolShek vs Nudlers — Competitive Analysis

**Date**: 2026-03-30
**Nudlers repo**: https://github.com/enudler/nudlers
**Nudlers license**: Polyform Noncommercial 1.0.0 — we CANNOT copy code, only learn from feature concepts.

---

## Where KolShek Wins

1. **CLI-First Architecture** — 21 commands with `--json` output. Nudlers is web-only (Next.js), no CLI, no scriptability
2. **AI Agent Integration** — 6 specialized skills, plugin system for Claude/OpenCode/Codex/OpenClaw, SQL query interface for agents. Nudlers has basic Gemini chat + MCP server but no structured agent workflow
3. **Single Binary Distribution** — Compiled Bun binary, one-liner installers, self-update with SHA256. Nudlers needs Node 22 + PostgreSQL 16 + Docker
4. **Zero Cloud Dependencies** — SQLite (bun:sqlite), fully offline. Nudlers requires PostgreSQL
5. **OS Keychain Security** — Windows Credential Manager, macOS Keychain, libsecret. Nudlers uses AES-256-GCM vault only
6. **Hebrew Translation Engine** — Dedicated pattern-based translation rules. Nudlers has no equivalent
7. **Automated Insights Engine** — Spend spikes, large txns, new merchants, trend warnings with 3-tier severity. Nudlers has no equivalent
8. **OS-Native Scheduling** — schtasks/launchd/cron, no Docker needed. Missed sync detection
9. **Provider Aliases** — Multiple instances of same bank (personal + business). Nudlers has no alias concept
10. **Custom Dashboard Pages** — JSON widget definitions. Nudlers has fixed views only

---

## Where Nudlers Wins

1. **Budget System** — Per-category budgets, total cap, real-time tracking with progress bars, over-budget alerts, dedicated budget reports
2. **Recurring Payment Detection** — Auto-detect from history + manual entry + enable/disable/edit. Powers their projections
3. **Balance Projections** — 30-day per-account forecast using recurring payments + future CC charges (35-day window), daily granularity
4. **Web UI Polish** — 9 lazy-loaded views, RTL Hebrew, AI chat sidebar (Gemini), real-time sync drawer, responsive mobile/tablet/desktop
5. **Transaction Enrichment** — Notes, favorites, hidden flag, price editing, inline table editing
6. **WhatsApp Integration** — Daily summaries, budget alerts, QR-code auth
7. **WebAuthn / Passkeys** — Biometric + hardware key vault auth
8. **Card-to-Bank Linking** — Explicit credit card -> bank account ownership with nicknames, last-4-digit tracking
9. **Backup/Restore** — Full JSON export of all 16 tables + import/restore
10. **Scraper Audit Trail** — Trigger type, vendor, duration, errors, retry count, JSON reports (500 event cap)

---

## Feature Parity

- Israeli bank/credit card coverage (~16-18 institutions)
- Transaction search, filtering, pagination
- Category rule engine (pattern-based)
- Multi-account support, installment tracking, multi-currency
- Dark/light theme, Puppeteer scraping with anti-detection

---

## Roadmap — Owner-Prioritized Improvements

### Must-Have

1. **Recurring payment detection** — Auto-detect from transaction patterns + manual entry. Foundation for projections and insights
2. **Scraper audit trail** — Enrich sync_log: retry counts, duration, per-vendor errors, JSON reports
3. **Flexible budget system** — Extensible v1: per-category + total cap first, architecture designed so envelope, percentage-of-income, rolling avg, custom formulas are easy to add later. NOT Nudlers' fixed model
4. **Customizable insights/alerts** — Users define their own alert rules ("alert if dining > 2000/mo"). Differentiation — Nudlers has none
5. **Backup/restore** — Full DB export to JSON + import. Timestamped files
6. **Card-to-bank ownership linking** — Which CC bills from which bank account
7. **WhatsApp alerts** — Plugin module architecture:
   - Core alert engine lives in `core/` — rules, triggers, thresholds
   - Notification channels are pluggable modules (`kolshek plugin install whatsapp-alerts`)
   - Keeps core lean, user opts in per channel
   - Same pattern works for Telegram, email, etc.

### Should-Have

8. **Transaction enrichment** — Notes, favorites, hidden flag per transaction
9. **Balance projections** — 30-day per-account forecast. Needs strong algo: recurring + CC charges + seasonal. Aim for ML/statistical, not just summing known charges
10. **Dashboard UX polish** — Navigation, mobile, RTL Hebrew, sync progress UI, loading states, AI chat sidebar

### Design Principles

- **Flexibility over rigidity** — budgets, alerts, workflows are user-configurable
- **CLI-first, web-second** — every feature works via CLI + --json before dashboard
- **Local-first** — SQLite, no cloud, no accounts, no telemetry
- **AI-native** — features accessible to AI agents, not just humans

---

## What NOT to Copy

- PostgreSQL dependency — our SQLite advantage is real
- Docker-first deployment — our single binary wins
- Web-only architecture — our CLI-first approach is more versatile
- Gemini lock-in — our multi-agent approach (Claude/OpenCode/Codex) is better
- Fixed budget model — we should be more flexible
