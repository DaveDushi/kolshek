## Bug Fixes

- **Fix hapoalim login field**: The scraper expects `userCode` but we were prompting for `username`, causing the scraper to send empty credentials. If you previously added hapoalim, re-run `kolshek providers auth <id>` to re-enter credentials under the correct field name.
- **Fix yahav login fields**: Added missing `nationalID` field required by the yahav scraper.
- **Fix auto-fetch killing commands**: Auto-fetch (triggered when data is >24h stale) was calling `process.exit()` on errors, which prevented the original command (e.g. `list`, `summary`) from ever running. Auto-fetch now uses `syncProviders()` directly and always lets the original command proceed.
