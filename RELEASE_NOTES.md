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
