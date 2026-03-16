# Security Model

KolShek handles real bank credentials. Security is not optional.

## Credential Storage

Credentials are stored using a layered strategy:

1. **Environment variables** (CI/automation) — checked first via `KOLSHEK_CREDENTIALS_JSON`
2. **OS keychain** (primary) — Windows Credential Manager, macOS Keychain, or Linux `secret-tool`
3. **Encrypted file** (fallback) — AES-256-GCM encrypted local file when no keychain is available

Credentials are **never logged**, never included in error messages, and zeroed from memory after use.

## File Permissions

Database and config files are restricted to owner-only access:

- **Windows**: `icacls` removes inherited permissions and grants full control only to the current user
- **Unix**: `chmod 600` for files, `chmod 700` for directories

This runs automatically when the database or config directory is created.

## Read-Only Query Command

The `kolshek query` command enforces read-only access:

- Only `SELECT`, `WITH`, `EXPLAIN`, `PRAGMA`, and `VALUES` statements are allowed
- `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `CREATE` are blocked
- PRAGMA is restricted to a whitelist of read-only pragmas (e.g., `table_info`, `index_list`)
- PRAGMA setters (with `=`) are explicitly blocked
- Table names in `db schema` are validated against `[a-z_]+`

## Web Dashboard Security

The settings dashboard (`kolshek dashboard`) runs a local HTTP server with multiple protections:

- **Localhost only** — `Bun.serve()` binds to `hostname: "localhost"`, preventing LAN access
- **CSRF protection** — Origin header checked on all non-GET/HEAD requests; mismatches return 403
- **Security headers** — `X-Content-Type-Options: nosniff` and `X-Frame-Options: DENY`
- **XSS prevention** — all user-controlled content is HTML-escaped before rendering (toast messages, SSE events, form values)
- **Parameterized SQL** — all database operations use prepared statements with `$param` syntax
- **Input validation** — provider aliases validated server-side with `[a-zA-Z0-9_-]+` regex

## Dependency Pinning

Critical dependencies are pinned to exact versions to prevent supply-chain attacks:

- `israeli-bank-scrapers-core` pinned to `6.7.1` (no caret `^`)
