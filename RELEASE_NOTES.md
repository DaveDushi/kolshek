## v0.4.2

### Bug Fixes

- **Dashboard assets in compiled binary**: The server now falls back to embedded assets when filesystem files don't exist, fixing "Not Found" errors when running the compiled binary on a fresh machine.
- **Category classification**: Use upsert pattern for category rules, preventing duplicate constraint errors when reclassifying transactions.
- **Auto-build in dev**: The `dashboard` command now auto-builds the React SPA if `dist/` is missing, so `bun run dev -- dashboard` works without a manual `bun run build:web` step.
