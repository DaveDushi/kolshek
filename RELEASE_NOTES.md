## v0.4.4

### Bug Fixes

- **AI model loading in compiled binary**: Rewrote the `node-llama-cpp` import strategy to reliably resolve the package and all its transitive dependencies (e.g. `lifecycle-utils`) when running as a compiled binary. Uses an ESM loader file placed in the install directory so Bun resolves from the correct `node_modules` tree.
- **Model load errors now visible**: Errors during model loading are logged to the terminal instead of being silently returned as HTTP 400 responses.
