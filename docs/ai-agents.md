# AI Agent Integration

KolShek is built for AI agents. Every command supports `--json` for structured output, and the `query` and `db` commands give agents direct SQL access to your financial data.

## Install a Plugin

```bash
kolshek plugin install claude-code   # Claude Code
kolshek plugin install opencode      # OpenCode
kolshek plugin install codex         # Codex (OpenAI)
kolshek plugin install openclaw      # OpenClaw
```

Run `kolshek plugin list` to see all available integrations and their install status.

### What Gets Installed

| Tool | Location | Contents |
|------|----------|----------|
| Claude Code | `~/.claude/plugins/kolshek/` | Full plugin (skills, hooks, references) |
| OpenCode | `.opencode/skills/kolshek-*/` | Skills with embedded CLI reference |
| Codex | `~/.codex/skills/kolshek-*/` + `AGENTS.md` | Skills + agent discovery index |
| OpenClaw | `~/.openclaw/workspace/skills/kolshek-*/` | Skills (agentskills.io format) |

### Skills Included

| Skill | Description |
|-------|-------------|
| `init` | Set up KolShek — connect providers, fetch transactions, translate, categorize |
| `translate` | Translate Hebrew transaction descriptions to English |
| `categorize` | Analyze transactions and create auto-categorization rules |
| `analyze` | Deep-dive financial analysis with savings opportunities and action plans |
| `review` | Monthly financial review — budget compliance, anomalies, report card |

## Structured Output

Every command supports `--json`, returning a consistent envelope:

```json
{
  "success": true,
  "data": { ... },
  "metadata": { "count": 42, "from": "2026-01-01", "to": "2026-03-16" }
}
```

Errors follow the same pattern:

```json
{
  "success": false,
  "error": {
    "code": "AUTH_FAILED",
    "message": "Authentication failed for provider hapoalim",
    "retryable": false,
    "suggestions": ["Run 'kolshek providers test hapoalim'"]
  }
}
```

## Schema Discovery

Agents can discover the database schema without prior knowledge:

```bash
kolshek db tables --json      # List all tables
kolshek db schema transactions --json  # Column details
```

## SQL Queries

The `query` command gives read-only SQL access:

```bash
kolshek query "SELECT description, SUM(charged_amount) as total FROM transactions GROUP BY description ORDER BY total LIMIT 10" --json
```

Only `SELECT`, `WITH`, `EXPLAIN`, and safe `PRAGMA` statements are allowed.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Bad arguments |
| 3 | Auth failure |
| 4 | Timeout |
| 5 | Blocked by provider |
| 10 | Partial success (some providers failed) |

## Non-Interactive Mode

For automation, use `--non-interactive` to prevent prompts:

```bash
kolshek fetch --non-interactive --json
```

If input is required (e.g., OTP), the command fails with exit code 3 instead of hanging.
