## v0.3.10

### Features

- **Dashboard sync scheduling**: Manage automatic sync schedules directly from the dashboard — enable/disable OS task scheduler, pick preset or custom intervals (including minute-level granularity), and view sync history with success/failure status.
- **Missed sync detection**: Dashboard warns when syncs were missed because the computer was off during scheduled times.

### Bug Fixes

- **Windows Task Scheduler**: Fixed scheduling to work without admin elevation by using inline `schtasks` params instead of XML import.
- **DML validation**: Added SQL statement validation to prevent destructive queries, with improved error diagnostics for database operations.
- **Currency formatting**: Fixed crash when currency parameter is undefined during amount formatting.

### Security

- **Scheduler path validation**: Added `validateBinaryPath` to reject shell metacharacters (`&`, `|`, `$`, etc.) and control characters in binary paths before passing them to OS schedulers (schtasks, cron, systemd, launchd).

### Other

- Upgraded GitHub Actions to v5 across all CI workflows.
