## Features

- **Show provider alias in CLI output**: Provider aliases (e.g. `max-personal`, `max-joint`) now display in all commands instead of just the generic company name.
- **Deduplicate accounts across providers**: When multiple provider configs share the same company (e.g. two Max logins), overlapping credit card accounts are now stored once instead of duplicated. Existing duplicates are automatically merged on upgrade. This also fixes transaction double-counting in reports.

## Bug Fixes

- **Fix process hanging after commands**: Commands no longer hang after completion; stale "run kolshek init" tip is hidden when providers already exist.
