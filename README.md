<div align="center">

<img src="assets/logo.png" alt="KolShek logo" width="180" />

# KolShek (כל שקל)

**Your Israeli finances, locally, on your terms.**

An open-source CLI that pulls transactions from Israeli banks and credit cards into a local SQLite database. No cloud. No telemetry. No account required.

[Quick Start](#quick-start) &bull; [Features](#features) &bull; [Supported Providers](#supported-institutions) &bull; [Usage](#usage) &bull; [AI Skills](#ai-agent-skills) &bull; [Security](#security) &bull; [Docs](docs/)

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![GitHub Release](https://img.shields.io/github/v/release/DaveDushi/kolshek)](https://github.com/DaveDushi/kolshek/releases)
[![Website](https://img.shields.io/badge/site-kolshek.com-6366f1)](https://kolshek.com)

</div>

---

**Personal finance is personal.** Every budgeting app forces you into someone else's system. KolShek doesn't. It fetches your data, stores it locally, and gives your AI agent full access to it. Ask it to build your budget, analyze your spending, or catch anomalies — however you manage your money, KolShek stays out of the way. Your data, your rules.

## Features

- **Web dashboard** — React SPA with 8 pages for managing providers, categories, translations, spending, trends, insights, and transactions with real-time sync progress
- **Built for AI agents** — first-class plugins for Claude Code, OpenCode, Codex, and OpenClaw. Let your AI assistant query your finances, analyze spending, generate reports, and spot anomalies
- **`kolshek query`** — read-only SQL so agents (or you) can ask anything
- **`kolshek db`** — schema introspection for agents to self-discover your tables
- **`--json` on every command** — structured output agents can parse and act on
- **18 Israeli banks & credit cards** — all major institutions supported
- **100% local** — SQLite database, nothing leaves your machine
- **OS keychain** — credentials stored in Windows Credential Manager, macOS Keychain, or Linux secret-tool
- **Reports** — monthly summaries, category breakdowns, balance history
- **Search & filter** — find transactions by text, amount, date, provider, or status
- **Auto-categorize** — create rules to tag transactions by merchant
- **Category migration** — rename, merge, or bulk-migrate categories via CLI — no direct DB access needed
- **Hebrew translation** — map Hebrew merchant names to English with your own rules
- **Bulk rule import** — import category or translation rules from JSON files
- **Scheduled sync** — automatic fetching via Task Scheduler, launchd, or cron

## Supported Institutions

| Banks | Credit Cards |
|---|---|
| Bank Hapoalim | Visa Cal |
| Bank Leumi | Max |
| Bank Discount | Isracard |
| Bank Mizrahi-Tefahot | American Express |
| Bank Mercantile | Beyahad Bishvilha |
| Bank Otsar Hahayal | Behatsdaa |
| Bank Union | |
| Bank Beinleumi | |
| Bank Massad | |
| Bank Yahav | |
| Bank One Zero | |
| Bank Pagi | |

Powered by [israeli-bank-scrapers](https://github.com/eshaham/israeli-bank-scrapers).

## Quick Start

**macOS / Linux:**

```bash
curl -fsSL https://kolshek.com/install.sh | sh
```

**Windows (PowerShell):**

```powershell
irm https://kolshek.com/install.ps1 | iex
```

Then run the setup wizard:

```bash
kolshek init
```

This walks you through adding your first bank or credit card, testing the connection, and fetching your initial transactions.

See your accounts:

```bash
kolshek accounts
```

(Optional) Install the AI agent plugin for your tool:

```bash
kolshek plugin install claude-code   # Claude Code
kolshek plugin install opencode      # OpenCode
kolshek plugin install codex         # Codex (OpenAI)
kolshek plugin install openclaw      # OpenClaw
```

> Or download binaries directly from [Releases](https://github.com/DaveDushi/kolshek/releases).

### Prerequisites

- **Google Chrome or Chromium** — needed for bank scraping. KolShek auto-detects your install, or set `KOLSHEK_CHROME_PATH`.

## Usage

```bash
# Fetch transactions from all providers
kolshek fetch

# Fetch from a specific provider, with a date range
kolshek fetch max --from 2024-01-01 --to 2024-06-30

# Search transactions
kolshek tx search "supermarket"

# Monthly spending report
kolshek report monthly

# Spending by category
kolshek report categories

# Add a categorization rule
kolshek cat rule add "Groceries" --match "שופרסל"

# Bulk-import category rules from JSON (file or stdin)
echo '[{"category":"Groceries","matchPattern":"שופרסל"}]' | kolshek cat rule import
kolshek cat rule import rules.json

# Rename or merge a category (updates transactions + rules)
kolshek cat rename "מזון וצריכה" "Groceries"

# Preview a rename without modifying data
kolshek cat rename "מזון וצריכה" "Groceries" --dry-run

# Bulk migrate categories from a mapping file
kolshek cat migrate --file category-map.json --dry-run

# List categories with source info (transactions, rules, or both)
kolshek cat list

# Translate a Hebrew merchant name
kolshek tr rule add "Shufersal" --match "שופרסל"

# Bulk-import translation rules from JSON (safe for names with apostrophes)
echo '[{"englishName":"Ouri'\''s Market","matchPattern":"אורי מרקט"}]' | kolshek tr rule import
kolshek tr rule import rules.json

# Schedule automatic sync every 12 hours
kolshek schedule set 12h

# Run a SQL query
kolshek query "SELECT description, SUM(chargedAmount) as total FROM transactions GROUP BY description ORDER BY total LIMIT 10"

# Open the web settings dashboard
kolshek dashboard

# Update to the latest version
kolshek update

# Structured output for AI agents
kolshek accounts --json
```

## AI Agent Skills

The plugin gives your AI agent specialized skills for working with your financial data:

| Skill | What it does |
|-------|-------------|
| `/kolshek:init` | Set up from scratch — connect banks, fetch transactions, translate Hebrew, categorize spending |
| `/kolshek:translate` | Translate Hebrew merchant names to English with review and approval |
| `/kolshek:categorize` | Analyze transactions and create auto-categorization rules for expenses and income |
| `/kolshek:analyze` | Deep-dive financial analysis — income/expense mapping, savings opportunities, phased action plan |
| `/kolshek:review` | Monthly financial review — budget compliance, anomaly detection, report card |

The `analyze` and `review` skills were designed by [Adir Traitel](https://adirtraitel.com/).

See [AI Agent Integration](docs/ai-agents.md) for full details.

## Configuration

Config lives at your platform's standard config directory (e.g. `~/.config/kolshek/config.toml` on Linux/macOS, `AppData` on Windows).

| Env Variable | Description |
|---|---|
| `KOLSHEK_CHROME_PATH` | Path to Chrome/Chromium binary |
| `KOLSHEK_CONCURRENCY` | Parallel provider fetches (default: 2) |
| `KOLSHEK_CREDENTIALS_JSON` | Inline credentials for CI/automation |

## Security

- Credentials stored in your **OS keychain** (Windows Credential Manager, macOS Keychain, Linux `secret-tool`). Falls back to a local AES-256-GCM encrypted file.
- Credentials **never logged** and zeroed from memory after use.
- All data stays on your machine — no cloud sync, no telemetry, no analytics.
- Database and config files restricted to owner-only permissions (icacls on Windows, chmod on Unix).
- The `query` command is read-only — whitelisted `SELECT` and safe `PRAGMA` only, no writes.
- Web dashboard binds to `localhost` only, with CSRF protection and XSS-safe HTML rendering.

## Building from Source

```bash
git clone https://github.com/DaveDushi/kolshek.git
cd kolshek
bun install
bun run build
```

Cross-platform builds:

```bash
bun run build:windows-x64
bun run build:linux-x64
bun run build:linux-arm64
bun run build:macos-x64
bun run build:macos-arm64
```

## Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

```bash
bun run dev -- <command>   # Run in dev mode
bun test                   # Run tests
bun run typecheck          # Type check
```

## Disclaimer

KolShek stores your bank credentials and financial data locally on your machine. By using this tool, you accept responsibility for securing your device and reviewing the code you run. This is an open-source project maintained by volunteers — it comes with no warranty, and is not affiliated with any financial institution. Use at your own risk.

## License

[MIT](LICENSE)
