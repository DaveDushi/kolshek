## Features

- **Multi-field category rule engine**: Category rules now support matching on multiple transaction fields (description, memo, amount, etc.) with AND logic, regex/substring/exact modes, and priority ordering. Replaces the old single-pattern rules (auto-migrated on upgrade).
- **Recategorize and reassign commands**: New `categorize reassign` applies updated rules to existing transactions, and `categorize recategorize` lets you re-run categorization interactively.
- **Category bulk import, migration, and rename**: New CLI commands for importing rules from stdin/file, migrating rule formats, and renaming categories across all transactions and rules.
- **CC billing charge handling**: Reports now detect and flag credit card billing lines in bank statements to prevent double-counting expenses.
- **stdin support for rule import**: Pipe rules directly into `categorize rule import` from other tools or scripts.

## Bug Fixes

- **Shell quoting with special characters**: Fixed quoting bugs when merchant names contain characters that break shell parsing.
- **Remove seed translations/rules**: Seed data no longer auto-inserted — users define their own rules from scratch.

## Security

- **Windows file permission hardening**: Database and config directories now use `icacls` ACLs on Windows (where `chmod` is a no-op) to restrict access to the current user only.
- **Credential zeroing**: Bank credentials are now zeroed from memory after use in all provider commands (`add`, `auth`, `test`, `init`).
- **Read-only PRAGMA whitelist**: The `query` command now restricts PRAGMAs to a safe read-only set, blocking mutating PRAGMAs like `journal_mode=DELETE`.
- **SQL injection guard on schema introspection**: Added regex validation on table names in `db schema` to harden the PRAGMA interpolation.
- **Pinned scraper dependency**: `israeli-bank-scrapers-core` pinned to exact version `6.7.1` to mitigate supply chain risk.

## Other

- **Added README** with usage examples, architecture overview, and contribution guide.
