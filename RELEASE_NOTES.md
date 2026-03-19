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
