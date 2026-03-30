## v0.4.5

### Features

- **CSV import: auto-create providers**: Uploading a CSV with an unknown provider (e.g., `chase`, `bofa`, `wells-fargo`) now automatically creates the provider instead of failing. This is the core use case for CSV import -- users importing from banks not supported by the scraper no longer need to manually run `kolshek providers add` first.
- **CSV import: `provider_type` column**: Optional column in imported CSVs to specify whether an auto-created provider is a `bank` or `credit_card` (defaults to `bank` if omitted).
- **Upload CSV skill**: New `/kolshek:upload-csv` skill that guides users through importing transactions from any bank's CSV export (Chase, Bank of America, Wells Fargo, Amex, Capital One, etc.) by auto-mapping columns to KolShek format.
- **Account exclusion during setup**: Users can now exclude specific accounts from syncing during `kolshek providers add`.
- **Account exclusion in dashboard**: Account exclusion toggles moved to provider cards in the dashboard for easier access.

### Bug Fixes

- **Dashboard import endpoint**: Fixed provider auto-creation not working in the web dashboard due to dynamic imports not resolving correctly at runtime. All server imports are now static top-level imports.
- **Trends chart ordering**: Fixed chronological ordering in trends data; reversal moved to presentation layer.
- **Installer setup**: Replaced `pluginDirs` with marketplace registration and improved setup UX.

### Other

- **Removed local AI agent**: Removed the local LLM agent feature and its `node-llama-cpp` dependency.
- **Removed reconciliation**: Removed the transaction reconciliation feature in favor of the simpler CSV import flow.
