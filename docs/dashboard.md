# Web Dashboard

The settings dashboard provides a browser UI for managing providers, categories, and translations.

## Quick Start

```bash
kolshek dashboard
```

This opens a local web server (default: `http://localhost:5556`) with three pages:

- **Providers** — add, edit, remove, and test bank/credit card connections; fetch transactions with real-time progress
- **Categories** — create category rules, view spending breakdowns, reassign transactions between categories
- **Translations** — manage Hebrew-to-English merchant name mappings; see untranslated descriptions grouped by frequency

## Features

### Provider Management

- Add providers by selecting a bank/credit card and entering credentials
- Test connections before saving
- Fetch transactions from all providers with a single click
- Real-time progress via Server-Sent Events (SSE) — see each provider's status as it updates

### Category Rules

- Create rules matching on description, memo, amount, account, or direction
- Support for substring, exact, and regex matching
- Set priority to control rule evaluation order
- Apply rules to uncategorized transactions or re-apply to all
- Interactive transaction reassignment between categories

### Translation Rules

- Map Hebrew merchant names to English equivalents
- View untranslated descriptions grouped by frequency
- One-click rule creation from untranslated list
- Apply rules to fill `description_en` for matching transactions

## Architecture

The dashboard is built with:

- **Bun.serve()** — lightweight HTTP server bound to localhost
- **HTMX** — dynamic page updates without a JS framework
- **Tailwind CSS v4** — built at startup via `@tailwindcss/cli`
- **SSE** — real-time fetch progress streaming

All data stays local. The server only accepts connections from `localhost`.
