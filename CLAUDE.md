# KolShek (כל שקל)

Israeli finance CLI — scrapes banks/credit cards via `israeli-bank-scrapers-core`.

## Commands

```
bun run dev -- <command>    # Run CLI in dev
bun test                    # Run vitest
bun run typecheck           # tsc --noEmit
```

## Non-obvious conventions

- **Runtime is Bun** — use `bun:sqlite` (not better-sqlite3), `Bun.file()`, `Bun.spawn()`
- **ESM with .js extensions** — all imports use `.js` even for `.ts` files
- **core/ is pure** — `src/core/` must NOT import from `cli/` or `db/`. It operates on plain types only. This enables future MCP server / web UI without refactoring
- **Dedup hashes** — `transactionHash` uses Caspion-compatible format (date rounded to minute + chargedAmount + description + memo + companyId + accountNumber). Don't change the hash formula without migration
- **Credentials flow** — env vars checked first (CI), then OS keychain. Never log credentials. Zero after use
- **Scraper imports** — `israeli-bank-scrapers-core` (not `israeli-bank-scrapers`). Uses `puppeteer-core` + system Chrome
- **CompanyTypes mapping** — map string companyId to enum via `CompanyTypes[companyId as keyof typeof CompanyTypes]`
- **All commands support `--json`** — output uses `{ success, data, metadata }` envelope. Errors use `{ success: false, error: { code, message, retryable, suggestions } }`
- **Exit codes** — 0=success, 1=error, 2=bad args, 3=auth failure, 4=timeout, 5=blocked, 10=partial success
- **Date input** — CLI accepts YYYY-MM-DD, DD/MM/YYYY, or relative "30d"
- **DB params** — bun:sqlite uses `$name` syntax: `db.prepare("... WHERE id = $id").get({ $id: 1 })`
