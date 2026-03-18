## v0.3.7

### Features

- **React dashboard with client-side routing**: Full SPA dashboard with 8 pages — overview, transactions, spending, trends, insights, categories, translations, and providers. Includes live sync progress panel, per-provider status tracking, and theme switching.
- **Classification-based filtering**: Transactions are now classified (expense, income, transfer, cc_billing, etc.) with filtering support across all report and trend endpoints.
- **Custom classifications**: Users can create and assign custom classifications beyond the built-in set via the dashboard classification panel.
- **Real-time sync streaming**: Bank sync now streams per-provider SSE events (start → progress → result → done) with live reconnection support for late-joining clients.

### Security

- **Session authentication**: Dashboard requires a cryptographic token (generated at launch, exchanged for an HttpOnly/SameSite=Strict cookie) — no more open endpoints.
- **CORS hardening**: Replaced wildcard `Access-Control-Allow-Origin: *` with an explicit origin allowlist and exact-match validation.
- **CSRF protection**: All mutations reject requests with missing or non-allowlisted `Origin` headers.
- **Path traversal prevention**: Static file serving validates resolved paths stay within the build output directory.
- **Content-Security-Policy**: Added CSP header restricting scripts, styles, images, and connections to same-origin only.
- **ReDoS prevention**: User-supplied regex patterns are validated for length, nested quantifiers, and excessive alternation before compilation.
- **Error sanitization**: All API and SSE error responses strip file paths, stack traces, and internal details.
- **Pagination limits**: Transaction endpoints capped at 500 rows per request to prevent database dumps.
- **Windows permission fix**: Switched from Node's `child_process.spawnSync` to `Bun.spawnSync` for reliable `icacls` permission hardening.

### Bug Fixes

- **Fixed sync endpoint mismatch**: Client and server now agree on `/api/v2/fetch` route and SSE event types (`start`, `progress`, `result`, `done`).
- **Fixed SSE reconnection**: `GET /api/v2/fetch/events` now streams live events instead of returning a dead snapshot.
- **Fixed Vite dev server auth**: Added `credentials: "include"` on client and `Access-Control-Allow-Credentials` on server for cross-origin cookie support.
- **Fixed duplicate favicon route**: Removed dead code branch for `/favicon.png` that shadowed the `/favicon.ico` handler.

### Other

- **Removed legacy HTMX partials**: Deleted all server-rendered HTML templates, styles, and layout files (~1,500 lines) in favor of the React SPA.
- **Site polish**: Updated favicon, added GitHub stars badge, footer credits, and improved nav/chat/theme toggle on the docs site.
