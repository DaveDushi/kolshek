## v0.4.6

### Bug Fixes

- **Category rules now apply to all transactions**: Creating a rule or clicking "Apply Rules" now re-categorizes all transactions (not just uncategorized ones), so miscategorized transactions can be corrected.
- **"Add Rule" button in empty state**: The Categories page now shows a create button when no rules exist.

### Performance

- **Route-level code splitting**: Dashboard pages are lazy-loaded with `React.lazy()` and `Suspense`, reducing initial bundle size.
- **Vendor chunk splitting**: React, Recharts, and React Query are split into separate cached chunks for faster repeat loads.
- **Babel replaced with SWC**: Switched Vite's React plugin to SWC for faster HMR and builds.

### Code Quality

- **Shared service layer**: Extracted duplicated business logic between CLI and dashboard into `src/services/` and `src/shared/`.
- **Consistent function naming**: Standardized repository functions to CRUD verbs (`create/list/get/update/delete`), query functions from `resolve*` to `execute*`.
- **Eliminated dynamic imports**: Converted unnecessary `await import()` / `require()` calls to static top-level imports.
- **Extracted SSE stream helper**: Deduplicated SSE stream construction in the dashboard server.
- **Shared `useNavBadges` hook**: Deduplicated badge computation between sidebar and mobile nav.
- **O(1) classification lookups**: Classification functions use `Map` instead of `Array.find()`.
- **Modern array sorting**: `.toSorted()` across dashboard components.
- **Default page exports**: Cleaner `React.lazy()` integration.
