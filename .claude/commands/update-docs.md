---
description: Sync all documentation with the codebase source-of-truth files
user_arg: (optional) space-separated doc targets to update — e.g., "commands readme site changelog". Defaults to all.
---

Synchronize documentation files with the codebase. The code is always the source of truth.

## Valid Targets

| Target | File(s) |
|--------|---------|
| `readme` | `README.md` |
| `commands` | `docs/commands.md` |
| `agents` | `docs/ai-agents.md` |
| `security` | `docs/security.md` |
| `dashboard` | `docs/dashboard.md` |
| `docs-index` | `docs/README.md` |
| `site` | `site/index.html` + `site/docs.html` (commands, guides, and feature sections) |
| `cli-ref` | `plugin/references/cli-reference.md` |
| `changelog` | `CHANGELOG.md` is source of truth → syncs to `site/docs.html` changelog section + `RELEASE_NOTES.md` |

If "$ARGUMENTS" is empty or "all", update every target. Otherwise, update only the listed targets (space-separated).

---

## Phase 1: Read All Source-of-Truth Files

Read these files completely — do NOT skip any. You need the full content to detect drift.

### Provider Registry
- `src/types/provider.ts` — the `PROVIDERS` record is the canonical list of supported institutions (company IDs, display names, types, login fields). Count banks and credit cards separately.

### CLI Commands & Flags
- `src/cli/index.ts` — global options, command registration order
- Every file in `src/cli/commands/*.ts` — read each one. Extract: command name, aliases, description, subcommands, all `.option()` and `.requiredOption()` calls, and `.argument()` calls. Pay close attention to:
  - Flag names and their descriptions
  - Whether options use `--flag` vs `-f, --flag` short aliases
  - Default values passed as the third argument to `.option()`
  - Required vs optional options
- `src/cli/filter-utils.ts` — shared `--exclude` / `--include` classification flags added via `addClassificationOptions()`

### AI Skills
- Read all `plugin/skills/*/SKILL.md` files — extract: name, description, version from YAML frontmatter

### Version & Metadata
- `package.json` — version, description, dependencies list
- `plugin/.claude-plugin/plugin.json` — plugin version

### Dashboard
- `src/web/server.ts` (first 50 lines) — actual default port and bind behavior

### Changelog
- `CHANGELOG.md` — the full changelog (source of truth for release history)
- `RELEASE_NOTES.md` — should match the latest CHANGELOG section

After reading, note any version mismatches between package.json, plugin.json, and SKILL.md files. These are NOT for you to fix here — the `/release` command handles version bumps. But DO mention them in the summary.

---

## Phase 2: Compare and Identify Drift

For each target doc, compare its content against the source files you just read. Build a list of discrepancies:

### What to check per target

**`readme` (README.md)**
- "Supported Institutions" table matches `PROVIDERS` record (count, names, bank/CC grouping)
- Features list matches actual capabilities
- AI Skills table matches SKILL.md files (name, description)
- Usage examples use valid command syntax
- Plugin install tools list matches `SUPPORTED_TOOLS` in `src/cli/commands/plugin.ts`
- Quick Start steps are accurate

**`commands` (docs/commands.md)**
- Global options table matches `program.option()` calls in `src/cli/index.ts`
- Every command and subcommand in `src/cli/commands/*.ts` has a corresponding section
- Every `.option()` / `.requiredOption()` in the code is documented with correct flag name and description
- No removed flags are still listed (e.g., `--lifestyle` was replaced by `--exclude`/`--include`)
- Command aliases match (e.g., `tx`, `bal`, `cat`, `tr`, `report`, `sql`)
- Subcommand trees are complete (e.g., `categorize classify set/list/auto`)

**`agents` (docs/ai-agents.md)**
- Skills table matches all SKILL.md files
- Plugin install commands match `SUPPORTED_TOOLS`
- Exit codes table matches `ExitCode` enum in `src/cli/output.ts`
- JSON envelope format is accurate

**`security` (docs/security.md)**
- Credential storage layers are accurate
- Dependency pinning versions match `package.json`

**`dashboard` (docs/dashboard.md)**
- Default port matches code
- Feature descriptions match actual dashboard (React SPA, not HTMX)

**`docs-index` (docs/README.md)**
- Links to all doc files that exist
- Includes a link to the root `CHANGELOG.md`

**`site` (site/index.html + site/docs.html)**
- `site/index.html`: Provider count and names in features section match `PROVIDERS`. Provider chips in providers section match `PROVIDERS` (bank vs CC grouping). Skills count and list are accurate. Feature descriptions match reality.
- `site/docs.html` commands/guides sections: Every command, subcommand, and flag matches the code. Global options table is accurate. Plugin install examples use correct tool names from `SUPPORTED_TOOLS`. Dashboard guide reflects current architecture (React, not HTMX). Security guide is accurate.

**`cli-ref` (plugin/references/cli-reference.md)**
- Every command signature and flag matches the code
- No phantom commands listed (e.g., `translate seed` if it doesn't exist)
- Exit codes, JSON envelope, DB schema overview are accurate
- Classification flag documentation is current

**`changelog` (CHANGELOG.md → site/docs.html + RELEASE_NOTES.md)**
- `RELEASE_NOTES.md` matches the latest section of `CHANGELOG.md` exactly
- `site/docs.html` changelog section (after the commands/guides) matches `CHANGELOG.md` converted to HTML. Check every version entry — features, bug fixes, security, other.
- Factual accuracy: if `CHANGELOG.md` claims a feature exists (e.g., "HTMX dashboard") but the code contradicts it (e.g., React), fix the CHANGELOG claim. Historical entries should reflect the state at release, but obvious factual errors (wrong tech names, removed features described as current) should be corrected.

---

## Phase 3: Report and Update

1. Print a summary of all discrepancies found, grouped by file:

```
## Documentation Drift Report

### docs/commands.md (5 issues)
- MISSING: `categorize classify set/list/auto` subcommands
- STALE: `--lifestyle` flag on spending (replaced by --exclude/--include)
...

### site/docs.html (3 issues)
- STALE: Dashboard guide says "HTMX" (now React SPA)
- STALE: Plugin install examples show unsupported tools
- DRIFT: Changelog v0.3.7 section incomplete vs CHANGELOG.md
...

### No issues found:
- docs/security.md
```

2. If there are zero discrepancies across all targeted files, say so and stop.

3. If there are discrepancies, update each affected file:
   - Preserve the existing structure, formatting, and style of each file
   - For Markdown files: match existing heading levels, table formats, spacing conventions
   - For HTML files (`site/index.html`, `site/docs.html`): only change text content, attributes, and list items. Never restructure the DOM, alter CSS classes, or modify JavaScript.
   - For `plugin/references/cli-reference.md`: this is a compact reference — use the terse code-block style it already uses, not the verbose table style from `docs/commands.md`

4. After all updates, run `git diff` to show what changed.

5. Present a summary:
   - Files updated (count)
   - Key changes per file (1-2 lines each)
   - Any version mismatches noticed (for awareness, not fixed by this command)

6. Ask: "Commit these documentation updates?" If confirmed, commit with message:
   `docs: sync documentation with codebase`
   Include a body listing the key changes.

---

## Important Rules

- **Never invent features.** If something is in the docs but not in the code, REMOVE it from the docs.
- **Never remove doc-only content** like explanatory paragraphs, tips, "What's next" sections, or architectural descriptions — only sync factual claims (commands, flags, providers, versions, counts).
- **Preserve voice and tone.** Each doc has its own style. `cli-reference.md` is terse and agent-facing. `README.md` is user-facing with marketing flair. `docs/commands.md` is detailed reference. Match each.
- **HTML changes are surgical.** In `site/index.html` and `site/docs.html`, only change text nodes and attributes. Never restructure the DOM, alter CSS classes, or modify JavaScript.
- **The code always wins.** If the docs say one thing and the code says another, update the docs to match the code.
- **CHANGELOG.md is source of truth for release history.** The `site/docs.html` changelog section and `RELEASE_NOTES.md` derive from it — not the other way around.
- **Don't fix version mismatches.** The `/release` command handles version bumps. Just report them.
