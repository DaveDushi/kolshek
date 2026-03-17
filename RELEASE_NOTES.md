## v0.3.2

### Features

- **Web settings dashboard**: New `kolshek dashboard` command launches an HTMX-powered browser UI for managing providers, categories, and translations — with real-time fetch progress via SSE
- **Custom Tailwind v4 design system**: Dashboard uses a custom indigo/zinc design system with dark mode, replacing the old Pico CSS dependency
- **Logo**: KolShek logo added to the dashboard navbar and browser favicon

### Security

- **Localhost-only binding**: Dashboard server binds to `localhost`, preventing LAN exposure
- **CSRF protection**: Origin header checked on all mutation requests; mismatches return 403
- **XSS prevention**: All user-controlled content (toasts, SSE events, form values) is HTML-escaped before rendering
- **Security headers**: `X-Content-Type-Options: nosniff` and `X-Frame-Options: DENY` on all responses
- **Type-safe rule validation**: Category rule conditions and match modes are properly validated server-side (removed `as any` casts)
- **SSE race condition fix**: Event listeners registered before replay to prevent missed events on slow connections
- **Server-side alias validation**: Provider aliases validated with `[a-zA-Z0-9_-]+` regex

### Other

- Added MIT license, security policy (`SECURITY.md`), and documentation site (`docs/`)
- Extracted shared utilities (`escapeLike`, `simpleHash`, `formatRelativeTime`) to reduce code duplication
- Wrapped `applyTranslationRules` in a database transaction for atomicity
- Updated agent definitions to standard format with triggering examples
- Removed dead `provider-table.ts` partial
