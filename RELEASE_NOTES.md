## v0.3.5

### Security

- **Migrated credential storage to Bun.secrets**: Replaced platform-specific subprocess wrappers (PowerShell+advapi32, macOS `security` CLI, Linux `secret-tool`) with Bun's native `Bun.secrets` API. Eliminates credential exposure in process listings and removes the PowerShell script injection surface.
- **Input validation on credential aliases**: All credential storage functions now validate provider aliases against prototype pollution (`__proto__`, `constructor`), path traversal, and special character injection.
- **Atomic credential file writes**: Encrypted credential files now use write-to-temp + rename to prevent corruption on crash or power loss.
- **Windows permission hardening**: Credential files now get explicit owner-only ACLs via `icacls` (not just the parent directory). Permission failures are always logged instead of silently swallowed.
- **Keychain probe caching**: The OS keychain availability check is cached after the first call, avoiding repeated probe writes that could leave residual entries on process interruption.
- **Payload size limits**: Credential payloads larger than 64KB are rejected before parsing to prevent resource exhaustion.
- **Security test suite**: Added 47 unit tests covering alias validation, AES-256-GCM encrypt/decrypt roundtrips, tamper detection, error sanitization, and environment variable credential parsing.
