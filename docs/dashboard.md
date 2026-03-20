# Web Dashboard

The settings dashboard provides a browser UI for managing providers, categories, and translations.

## Quick Start

```bash
kolshek dashboard
```

This opens a local web server (default: `http://localhost:45091`) with a React SPA dashboard featuring 8 pages:

- **Dashboard** — net worth overview, cashflow chart, spending breakdown, automated insights, and recent transactions
- **Transactions** — browse, search, and filter all transactions with pagination
- **Spending** — monthly spending breakdown by category, merchant, or provider
- **Trends** — multi-month cashflow and spending trend analysis with charts
- **Insights** — financial alerts and recommendations based on spending patterns
- **Categories** — create category rules, view spending breakdowns, manage classifications
- **Translations** — manage Hebrew-to-English merchant name mappings; see untranslated descriptions grouped by frequency
- **Providers** — add, edit, remove, and test bank/credit card connections; fetch transactions with real-time sync progress

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

- **Bun.serve()** — lightweight HTTP server bound to localhost (127.0.0.1)
- **React** — full SPA with client-side routing via react-router
- **Tailwind CSS v4** — utility-first styling with Recharts for data visualization
- **SSE** — real-time per-provider sync progress streaming

All data stays local. The server only accepts connections from `localhost`.
