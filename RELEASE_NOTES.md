## v0.3.3

### Bug Fixes

- **macOS keychain credentials not readable after save**: Fixed `providers add` saving credentials that couldn't be read back on macOS. The `security` CLI was prompting interactively ("retype password") even with piped stdin, causing silent storage failures. Now passes password as `-w` argument with `-U` flag for reliable atomic updates.

### Other

- **Landing site**: Switched hosting from GitHub Pages to Cloudflare Pages
- **Landing site**: Added BETA badge, live download counter, docs page, provider logos, and plugin picker
