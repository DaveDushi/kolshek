# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in KolShek, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Email **security@kolshek.dev** or use [GitHub's private vulnerability reporting](https://github.com/DaveDushi/kolshek/security/advisories/new)
3. Include steps to reproduce, affected versions, and potential impact

We aim to acknowledge reports within 48 hours and provide a fix within 7 days for critical issues.

## Security Model

KolShek handles real bank credentials. Every design decision prioritizes data safety.

### Credential Storage

- **OS keychain** (primary) — Windows Credential Manager, macOS Keychain, Linux `secret-tool`
- **Environment variables** — for CI/automation via `KOLSHEK_CREDENTIALS_JSON`
- **Encrypted fallback** — AES-256-GCM encrypted local file when no keychain is available
- Credentials are **never logged** and zeroed from memory after use

### Data Protection

- All data stays local — no cloud sync, no telemetry, no analytics
- Database and config files restricted to owner-only permissions (`icacls` on Windows, `chmod` on Unix)
- Critical dependencies pinned to exact versions

### Query Safety

- `kolshek query` allows only `SELECT`, `WITH`, `EXPLAIN`, and whitelisted read-only `PRAGMA`
- All database operations use parameterized queries (`$param` syntax)
- Table names validated against `[a-z_]+` regex

### Web Dashboard

- Binds to `localhost` only — no LAN exposure
- CSRF protection via Origin header checking
- XSS prevention with HTML escaping on all user-controlled content
- Security headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.3.x   | Yes       |
| 0.2.x   | Yes       |
| < 0.2   | No        |

## Full Documentation

See [docs/security.md](docs/security.md) for the complete security architecture.
