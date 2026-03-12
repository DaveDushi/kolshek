<div align="center">

# KolShek (כל שקל)

**Your Israeli finances, locally, on your terms.**

An open-source CLI that pulls transactions from Israeli banks and credit cards into a local SQLite database. No cloud. No telemetry. No account required.

[Quick Start](#quick-start) &bull; [Features](#features) &bull; [Supported Banks](#supported-institutions) &bull; [Usage](#usage) &bull; [Security](#security)

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![GitHub Release](https://img.shields.io/github/v/release/DaveDushi/kolshek)](https://github.com/DaveDushi/kolshek/releases)

</div>

---

**Personal finance is personal.** Every budgeting app forces you into someone else's system. KolShek doesn't. It fetches your data, stores it locally, and gives your AI agent full access to it. Ask it to build your budget, analyze your spending, or catch anomalies — however you manage your money, KolShek stays out of the way. Your data, your rules.

## Features

- **Built for AI agents** — first-class plugins for Claude Code, Cursor, Gemini CLI, and more. Let your AI assistant query your finances, build your budget, generate reports, and spot anomalies
- **`kolshek query`** — read-only SQL so agents (or you) can ask anything
- **`kolshek db`** — schema introspection for agents to self-discover your tables
- **`--json` on every command** — structured output agents can parse and act on
- **17 Israeli banks & credit cards** — all major institutions supported
- **100% local** — SQLite database, nothing leaves your machine
- **OS keychain** — credentials stored in Windows Credential Manager, macOS Keychain, or Linux secret-tool
- **Reports** — monthly summaries, category breakdowns, balance history
- **Search & filter** — find transactions by text, amount, date, provider, or status
- **Auto-categorize** — create rules to tag transactions by merchant
- **Hebrew translation** — map Hebrew merchant names to English, with a built-in seed list
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

1. Download the latest binary for your platform from [Releases](https://github.com/DaveDushi/kolshek/releases)
2. Run the setup wizard:

```bash
kolshek init
```

This walks you through adding your first bank or credit card, testing the connection, and fetching your initial transactions.

3. See your accounts:

```bash
kolshek accounts
```

4. (Optional) Install the AI agent plugin:

```bash
kolshek plugin install claude-code
```

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

# Translate a Hebrew merchant name
kolshek tr rule add "Shufersal" --match "שופרסל"

# Bulk-import translation rules from JSON (safe for names with apostrophes)
echo '[{"englishName":"Ouri'\''s Market","matchPattern":"אורי מרקט"}]' | kolshek tr rule import
kolshek tr rule import rules.json

# Seed common Israeli merchant translations
kolshek tr seed

# Schedule automatic sync every 12 hours
kolshek schedule set 12h

# Run a SQL query
kolshek query "SELECT description, SUM(chargedAmount) as total FROM transactions GROUP BY description ORDER BY total LIMIT 10"

# Structured output for AI agents
kolshek accounts --json
```

## Configuration

Config lives at your platform's standard config directory (e.g. `~/.config/kolshek/config.toml` on Linux/macOS, `AppData` on Windows).

| Env Variable | Description |
|---|---|
| `KOLSHEK_CHROME_PATH` | Path to Chrome/Chromium binary |
| `KOLSHEK_CONCURRENCY` | Parallel provider fetches (default: 2) |
| `KOLSHEK_CREDENTIALS_JSON` | Inline credentials for CI/automation |

## Security

- Credentials are stored in your **OS keychain** (Windows Credential Manager, macOS Keychain, Linux `secret-tool`). If unavailable, falls back to a local AES-256-GCM encrypted file.
- Credentials are **never logged** and zeroed from memory after use.
- All data stays on your machine. There is no cloud sync, no telemetry, no analytics.
- The `query` command is read-only — `SELECT` only, no writes.

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

## License

[MIT](LICENSE)
