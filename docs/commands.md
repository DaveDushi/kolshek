# KolShek CLI Command Reference

## Global Options

All commands support these flags:

| Flag | Description |
|------|-------------|
| `--json` | Output structured JSON |
| `-q, --quiet` | Suppress non-essential output |
| `--no-color` | Disable ANSI colors |
| `--no-progress` | Disable spinners and progress bars |
| `--non-interactive` | Never prompt; fail if input needed |
| `--no-auto-fetch` | Skip automatic fetch on stale data |
| `--version` | Show version |

---

## Command Tree

### `init`

First-run setup wizard — configure your first provider.

---

### `providers`

Manage bank and credit card providers.

#### `providers list`

List configured providers.

#### `providers add`

Add a new bank or credit card provider.

| Option | Description |
|--------|-------------|
| `--visible` | Show the browser window (needed for OTP / 2FA) |

#### `providers auth <id>`

Set or update credentials for an existing provider.

| Option | Description |
|--------|-------------|
| `--visible` | Show the browser window (needed for OTP / 2FA) |

#### `providers remove <id>`

Remove a configured provider.

#### `providers test <id>`

Test provider credentials.

| Option | Description |
|--------|-------------|
| `--visible` | Show the browser window (needed for OTP / 2FA) |

---

### `fetch [providers...]`

Fetch transactions from all or specific providers.

| Option | Description |
|--------|-------------|
| `--from <date>` | Start date (YYYY-MM-DD, DD/MM/YYYY, or 30d) |
| `--to <date>` | End date |
| `--force` | Re-fetch even if recently synced |
| `--type <type>` | Fetch only `bank` or `credit_card` |
| `--stealth` | Use stealth browser to avoid bot detection |
| `--visible` | Show the browser window (helps bypass bot detection) |

---

### `accounts` (alias: `bal`)

Show accounts and balances.

| Option | Description |
|--------|-------------|
| `--provider <name>` | Filter by provider company ID |
| `--type <type>` | Filter by provider type (`bank` \| `credit_card`) |

---

### `transactions` (alias: `tx`)

List, search, and export transactions.

#### `transactions list`

List transactions with filters.

| Option | Description |
|--------|-------------|
| `--from <date>` | Start date |
| `--to <date>` | End date |
| `--provider <name>` | Filter by provider company ID |
| `--type <type>` | Filter by provider type (`bank` \| `credit_card`) |
| `--account <number>` | Filter by account number |
| `--min <amount>` | Minimum charged amount |
| `--max <amount>` | Maximum charged amount |
| `--status <status>` | Filter by status (`pending` \| `completed`) |
| `--sort <field>` | Sort by `date` or `amount` (default: `date`) |
| `--limit <n>` | Maximum rows to return |

#### `transactions search <query>`

Search transactions by description.

| Option | Description |
|--------|-------------|
| `--from <date>` | Start date |
| `--to <date>` | End date |
| `--provider <name>` | Filter by provider |
| `--limit <n>` | Maximum results |

#### `transactions delete <id>`

Delete a transaction by ID. Use only for duplicates or erroneous records.

| Option | Description |
|--------|-------------|
| `--yes` | Skip confirmation prompt |

#### `transactions export <format>`

Export transactions to CSV or JSON.

| Option | Description |
|--------|-------------|
| `--from <date>` | Start date |
| `--to <date>` | End date |
| `--provider <name>` | Filter by provider |
| `--type <type>` | Filter by provider type |
| `--output <path>` | Write to file instead of stdout |

---

### `db`

Inspect database schema (tables and columns).

#### `db tables`

List available tables.

#### `db schema <table>`

Show column details for a table.

---

### `query <sql>` (alias: `sql`)

Run a read-only SQL query (SELECT, WITH, EXPLAIN, PRAGMA, VALUES). Use `kolshek db tables` to discover available tables.

| Option | Description |
|--------|-------------|
| `--limit <n>` | Maximum rows to return |

---

### `reports` (alias: `report`)

Financial analysis reports.

#### `reports monthly`

Monthly income/expenses/net breakdown.

| Option | Description |
|--------|-------------|
| `--from <date>` | Start date |
| `--to <date>` | End date |
| `--type <type>` | Filter by provider type (`bank` \| `credit_card`) |

#### `reports categories`

Expense breakdown by category.

| Option | Description |
|--------|-------------|
| `--from <date>` | Start date |
| `--to <date>` | End date |
| `--type <type>` | Filter by provider type (`bank` \| `credit_card`) |

#### `reports merchants`

Top merchants by spend.

| Option | Description |
|--------|-------------|
| `--from <date>` | Start date |
| `--to <date>` | End date |
| `--type <type>` | Filter by provider type (`bank` \| `credit_card`) |
| `--limit <n>` | Number of merchants to show (default: 20) |

#### `reports balance`

Account balances with 30-day activity summary.

---

### `categorize` (alias: `cat`)

Manage category rules and apply them to transactions.

#### `categorize rule`

Manage category rules.

##### `categorize rule add <category>`

Create a category rule.

| Option | Description |
|--------|-------------|
| `--match <pattern>` | Substring match on description |
| `--match-exact <pattern>` | Exact match on description |
| `--match-regex <pattern>` | Regex match on description |
| `--memo <pattern>` | Substring match on memo |
| `--account <account>` | Account filter (e.g. `leumi:12345` or `12345`) |
| `--amount <number>` | Exact amount match |
| `--amount-min <number>` | Minimum amount (inclusive) |
| `--amount-max <number>` | Maximum amount (inclusive) |
| `--direction <dir>` | Direction filter: `debit` or `credit` |
| `--priority <number>` | Rule priority — higher = evaluated first (default: 0) |

##### `categorize rule list`

List all category rules.

##### `categorize rule remove <id>`

Delete a category rule.

##### `categorize rule import [file]`

Bulk-import category rules from a JSON file or stdin. Accepts both legacy format `[{category, matchPattern}]` and new format `[{category, conditions, priority?}]`.

| Option | Description |
|--------|-------------|
| `--dry-run` | Validate and preview rules without importing |

#### `categorize apply`

Run category rules on transactions.

| Option | Description |
|--------|-------------|
| `--all` | Re-apply rules to all transactions, not just uncategorized |
| `--from-category <name>` | Re-apply rules only to transactions in this category |
| `--dry-run` | Preview changes without modifying data |

#### `categorize rename <old> <new>`

Rename or merge a category (updates transactions and rules).

| Option | Description |
|--------|-------------|
| `--dry-run` | Show what would change without modifying data |

#### `categorize migrate`

Bulk rename/merge categories from a JSON mapping file.

| Option | Description |
|--------|-------------|
| `--file <path>` | **(required)** JSON file with `{ oldName: newName }` mapping |
| `--dry-run` | Preview changes without modifying data |

#### `categorize reassign`

Force-reassign transactions matching a pattern to a new category.

| Option | Description |
|--------|-------------|
| `--match <pattern>` | Substring to match against transaction description |
| `--to <category>` | Target category |
| `--file <path>` | JSON file with `[{ "matchPattern": "...", "toCategory": "..." }]` |
| `--dry-run` | Preview changes without modifying data |

#### `categorize list`

Show categories with transaction counts, totals, and source.

---

### `translate` (alias: `tr`)

Manage Hebrew→English translation rules for transaction descriptions.

#### `translate rule`

Manage translation rules.

##### `translate rule add <english>`

Create a translation rule.

| Option | Description |
|--------|-------------|
| `--match <pattern>` | **(required)** Hebrew substring pattern to match against description |

##### `translate rule list`

List all translation rules.

##### `translate rule remove <id>`

Delete a translation rule.

##### `translate rule import [file]`

Bulk-import translation rules from a JSON file or stdin. Format: `[{"englishName": "...", "matchPattern": "..."}]`.

#### `translate apply`

Run translation rules on transactions with NULL `description_en`.

---

### `schedule`

Manage automatic fetch scheduling.

#### `schedule set`

Register a recurring fetch task with the OS scheduler.

| Option | Description |
|--------|-------------|
| `--every <interval>` | **(required)** Fetch interval (e.g. `6h`, `12h`, `24h`) |

#### `schedule remove`

Unregister the recurring fetch task.

#### `schedule status`

Show current schedule status.

---

### `plugin`

Manage AI agent integrations.

#### `plugin install <tool>`

Install AI plugin for a tool (`claude-code`, `openclaw`, `cursor`, `gemini-cli`, `antigravity`, `opencode`, `aider`, `windsurf`).

#### `plugin list`

List available tool integrations.

---

### `spending [month]`

Spending breakdown by category, merchant, or provider.

| Option | Description |
|--------|-------------|
| `--group-by <field>` | Group by: `category` (default), `merchant`, `provider` |
| `--category <name>` | Filter to a specific category |
| `--top <n>` | Limit to top N groups |
| `--type <type>` | Filter by provider type (`bank` \| `credit_card`) |
| `--lifestyle` | Exclude categories marked as non-spending |
| `-m, --month-offset <n>` | Months ago (e.g. `-m 3` for 3 months ago) |

#### `spending exclude`

Manage categories excluded from lifestyle spending view.

##### `spending exclude add <category>`

Mark a category as non-spending.

##### `spending exclude remove <category>`

Remove a category from the exclusion list.

##### `spending exclude list`

Show all excluded categories.

---

### `income [month]`

Income breakdown with salary detection (bank accounts only by default).

| Option | Description |
|--------|-------------|
| `--salary-only` | Show only salary/wage transactions |
| `--include-refunds` | Also show CC refunds (separate section) |
| `-m, --month-offset <n>` | Months ago (e.g. `-m 3` for 3 months ago) |

---

### `trends [months]`

Multi-month cashflow and spending trend analysis. Default: 6 months.

| Option | Description |
|--------|-------------|
| `--mode <mode>` | Analysis mode: `total` (default), `category`, `fixed-variable` |
| `--category <name>` | Track specific category (implies `--mode category`) |
| `--type <type>` | Filter by provider type (`bank` \| `credit_card`) |

---

### `insights`

Financial alerts and recommendations based on spending patterns.

| Option | Description |
|--------|-------------|
| `--months <n>` | Lookback period in months (default: 3) |
