## v0.4.3

### Features

- **Auto-install AI runtime**: When loading a model for the first time, the dashboard automatically detects bun or npm and installs `node-llama-cpp` into the data directory. No manual setup required.

### Bug Fixes

- **Windows SmartScreen block after update**: The `kolshek update` command now removes the Zone.Identifier stream from downloaded binaries, preventing Windows Application Control from blocking the updated executable.
