# UX Research Report: Israeli Finance CLI

## Executive Summary

This report covers CLI UX patterns for an Israeli finance tracking tool built on `israeli-bank-scrapers`. The tool must serve two audiences: **human users** (interactive terminal) and **AI agents** (structured, machine-readable output). Research draws from `gh`, `stripe`, `npm`, Inquirer.js, Commander.js, and Ink UI patterns.

---

## 1. Command Structure

### Recommended: Noun-Verb Hierarchy (like `gh`)

The `gh` CLI uses a `<resource> <action>` pattern that scales well. For a finance tool, this maps naturally to financial concepts.

```
finance <resource> <action> [flags]
```

### Proposed Command Tree

```
finance
  accounts
    list                    # List configured accounts/providers
    add                     # Interactive wizard to add a provider
    remove <provider>       # Remove a configured provider
    test <provider>         # Test credentials for a provider
    status                  # Show last scrape time, health per provider

  fetch
    [provider...]           # Fetch transactions (all providers or specific ones)
    --from <date>           # Start date (default: 30 days ago)
    --to <date>             # End date (default: today)
    --force                 # Re-fetch even if recent data exists

  transactions
    list                    # List transactions with filters
    --from <date>
    --to <date>
    --provider <name>
    --category <category>
    --min <amount>
    --max <amount>
    --status <pending|completed>
    --sort <date|amount>
    --limit <n>
    search <query>          # Full-text search in descriptions
    export <format>         # Export to CSV, JSON, OFX
    categorize              # Interactive categorization session

  report
    summary                 # Monthly income/expense summary
    --month <YYYY-MM>
    --period <range>
    cashflow                # Cash flow over time
    categories              # Spending breakdown by category
    providers               # Spending breakdown by bank/card
    trends                  # Month-over-month trends

  budget
    set <category> <amount> # Set monthly budget for category
    status                  # Show budget vs. actual
    list                    # List all budget rules
    remove <category>       # Remove a budget rule

  config
    show                    # Print current config
    set <key> <value>       # Set a config value
    path                    # Print config file path
    reset                   # Reset to defaults

  init                      # First-run setup wizard (alias for onboarding)
```

### Why This Structure

- **Discoverability**: Users can type `finance` and see top-level resources. Each resource lists its actions via `--help`.
- **Predictability**: Once you learn the pattern for one resource, all others follow suit.
- **Composability**: Machine consumers can construct commands programmatically.
- **Extensibility**: New resources (e.g., `finance loans`, `finance investments`) slot in naturally.

### Aliases and Shortcuts

```bash
finance ls          # alias for: finance transactions list
finance pull        # alias for: finance fetch
finance summary     # alias for: finance report summary
```

Keep aliases minimal to avoid confusion. Document them in `--help` output.

---

## 2. Dual-Audience Design (Human + AI Agent)

### The Core Principle

Every command that produces output should have two rendering paths:
1. **Human mode** (default): Colored, formatted tables, progress indicators, helpful messages.
2. **Machine mode** (`--json`): Structured JSON to stdout, no decoration, predictable schema.

### Implementation Pattern (inspired by `gh`)

```bash
# Human sees a pretty table
$ finance transactions list --from 2026-01-01 --limit 5

Date        Description          Amount    Provider    Status
2026-01-15  Shufersal Raanana    -₪247.50  visa-cal    completed
2026-01-14  Salary Deposit       +₪18,500  hapoalim    completed
2026-01-13  Electric Company     -₪385.00  leumi       pending
2026-01-12  HOT Internet         -₪109.90  max         completed
2026-01-11  Aroma TLV            -₪42.00   isracard    completed

Showing 5 of 142 transactions. Use --limit to see more.

# AI agent gets structured JSON
$ finance transactions list --from 2026-01-01 --limit 5 --json

{
  "transactions": [
    {
      "date": "2026-01-15",
      "processedDate": "2026-01-17",
      "description": "Shufersal Raanana",
      "originalAmount": -247.50,
      "originalCurrency": "ILS",
      "chargedAmount": -247.50,
      "provider": "visa-cal",
      "accountNumber": "****1234",
      "status": "completed",
      "type": "normal",
      "category": "groceries"
    }
  ],
  "meta": {
    "total": 142,
    "limit": 5,
    "offset": 0,
    "from": "2026-01-01",
    "to": "2026-02-27"
  }
}
```

### Key Design Rules for Dual-Audience

| Aspect | Human Mode | Machine Mode (`--json`) |
|--------|-----------|------------------------|
| Output destination | stdout (formatted) | stdout (JSON only) |
| Progress/spinners | stderr | stderr (or suppressed with `--quiet`) |
| Errors | stderr (colored, helpful) | stderr as JSON `{"error": {...}}` |
| Exit codes | 0 = success, 1 = error | Same, plus semantic codes |
| Prompts | Interactive on stdin | Fail with clear error if input needed |

### Exit Code Convention

```
0   Success
1   General error
2   Invalid arguments / usage error
3   Authentication failure (wrong credentials)
4   Provider timeout (scraping took too long)
5   Provider blocked (account locked, CAPTCHA)
10  Partial success (some providers failed)
```

### Additional Flags for Machine Consumers

```bash
--json              # Output as JSON
--json --jq <expr>  # Filter JSON output (like gh)
--quiet / -q        # Suppress all non-essential output
--no-color          # Disable ANSI colors (also auto-detected via NO_COLOR env)
--no-progress       # Disable progress indicators
--non-interactive   # Never prompt; fail if input required
```

### Environment Variable Detection

```
CI=true              -> auto-enable --no-color, --non-interactive, --no-progress
NO_COLOR=1           -> auto-disable colors (standard: https://no-color.org)
TERM=dumb            -> auto-disable colors and progress
FINANCE_OUTPUT=json  -> default to JSON output
```

---

## 3. Credential Flow

### The Challenge

Bank credentials are highly sensitive. The tool needs to balance:
- Security (never store plaintext)
- Convenience (don't ask for passwords every time)
- 2FA support (some providers require OTP codes)
- Automation (headless/CI environments)

### Recommended: Layered Credential Strategy

#### Layer 1: Interactive Setup Wizard (`finance accounts add`)

```
$ finance accounts add

Welcome! Let's connect a financial provider.

? Select provider:
  > Bank Hapoalim (hapoalim)
    Bank Leumi (leumi)
    Bank Discount (discount)
    Mizrahi Tefahot (mizrahi)
    Visa Cal (visaCal)
    Max (max)
    Isracard (isracard)
    Amex (amex)
    Bank Yahav (yahav)
    OneZero (oneZero)
    (16 providers available - scroll for more)

? Bank Hapoalim username: david_cohen
? Bank Hapoalim password: ••••••••••

Testing connection...
[============================] Connected successfully!

Found 2 accounts:
  - Checking ****4521 (Balance: ₪12,340.50)
  - Savings  ****4522 (Balance: ₪45,000.00)

? Save credentials securely to system keychain? (Y/n) Y

Credentials saved to system keychain.
Provider "hapoalim" is ready. Run 'finance fetch hapoalim' to get transactions.
```

#### Layer 2: System Keychain (Primary Storage)

Use the OS-native credential store via `keytar` or its successor:
- **Windows**: Credential Vault
- **macOS**: Keychain
- **Linux**: libsecret / Secret Service API

```typescript
// Credentials stored as:
// Service: "israel-finance-cli"
// Account: "hapoalim"
// Password: JSON.stringify({ username, password })
```

#### Layer 3: Environment Variables (CI/Automation)

```bash
# For CI/headless environments
export FINANCE_HAPOALIM_USERNAME=david_cohen
export FINANCE_HAPOALIM_PASSWORD=s3cur3p4ss

# Or a single JSON blob
export FINANCE_CREDENTIALS='{"hapoalim":{"username":"...","password":"..."}}'
```

#### Layer 4: Encrypted Config File (Fallback)

For systems without a keychain, offer an encrypted local file:
```
~/.config/finance-cli/credentials.enc
```
Encrypted with a master password that the user sets during `finance init`.

### 2FA / OTP Flow

The `israeli-bank-scrapers` library supports `otpCodeRetriever` callbacks. Design the UX around this:

```
$ finance fetch oneZero

Fetching from OneZero...
[====>                     ] Logging in...

! Two-factor authentication required.
? Enter the OTP code sent to your phone: 483291

[================>         ] Fetching transactions...
[============================] Done!

Fetched 47 transactions from OneZero.
```

For **long-term tokens** (supported by some providers):

```
$ finance accounts add oneZero --setup-token

This will set up a long-term authentication token so you won't
need to enter OTP codes for future fetches.

? Enter your phone number: 050-1234567
Sending OTP code...
? Enter the OTP code: 592041

Long-term token saved. Future fetches won't require OTP.
Token expires: 2026-08-27 (180 days). You'll be reminded to renew.
```

For **AI agent / non-interactive mode**:

```bash
# Agent must provide OTP via environment or pipe
$ echo "483291" | finance fetch oneZero --non-interactive

# Or via environment variable
$ FINANCE_OTP=483291 finance fetch oneZero --non-interactive
```

If OTP is needed but not available in non-interactive mode, exit with code 3 and a JSON error:

```json
{
  "error": {
    "code": "OTP_REQUIRED",
    "provider": "oneZero",
    "message": "Two-factor authentication required. Provide OTP via FINANCE_OTP env var or stdin."
  }
}
```

---

## 4. Long-Running Operations

Bank scraping takes 30-60 seconds per provider. Multiple providers means potentially several minutes. The UX must keep users informed without overwhelming them.

### Human Mode: Multi-Stage Progress

```
$ finance fetch

Fetching transactions from 4 providers...

  hapoalim   [=========>              ]  38%  Fetching transactions...
  leumi      [============================] Done  (52 transactions)
  visa-cal   [====>                   ]  18%  Logging in...
  max        [ Queued ]

Elapsed: 0:42  |  Estimated remaining: 0:35
```

Implementation: Use Ink's `<Spinner>` and `<ProgressBar>` components for a React-based terminal UI, or `ora` / `cli-progress` for a simpler approach.

### Machine Mode: Streaming JSON Events (stderr)

```bash
$ finance fetch --json 2>progress.log

# stderr (progress.log) contains newline-delimited JSON events:
{"event":"fetch:start","provider":"hapoalim","timestamp":"2026-02-27T10:00:00Z"}
{"event":"fetch:progress","provider":"hapoalim","stage":"login","percent":20}
{"event":"fetch:progress","provider":"hapoalim","stage":"transactions","percent":60}
{"event":"fetch:complete","provider":"hapoalim","transactions":87,"elapsed":28400}
{"event":"fetch:start","provider":"leumi","timestamp":"2026-02-27T10:00:28Z"}
...

# stdout contains the final result JSON only after all fetches complete
```

### Parallel vs. Sequential Fetching

- **Default**: Fetch providers in parallel (faster overall).
- **`--sequential`**: Fetch one at a time (lower resource usage, clearer progress).
- **`--concurrency <n>`**: Control parallelism (default: 3).

### Timeout Handling

```
$ finance fetch hapoalim

Fetching from Bank Hapoalim...
[==================>       ]  72%  Fetching transactions...

! Timeout after 90 seconds. Bank Hapoalim may be slow or experiencing issues.

? Retry? (Y/n) Y

Retrying...
[============================] Done!

Fetched 87 transactions from Bank Hapoalim.
```

---

## 5. Output Formatting

### Transaction Tables

Use column-aligned tables with smart truncation:

```
$ finance transactions list --month 2026-01

  Date        Description              Amount      Category      Provider
  ──────────  ───────────────────────  ──────────  ────────────  ──────────
  2026-01-31  משכורת ינואר             +₪18,500.00  income        hapoalim
  2026-01-28  שופרסל רעננה             -₪247.50     groceries     visa-cal
  2026-01-25  חשמל - חברת החשמל        -₪385.00     utilities     leumi
  2026-01-22  HOT Internet             -₪109.90     internet      max
  2026-01-20  ארומה תל אביב            -₪42.00      food          isracard
  2026-01-18  פארם רעננה               -₪89.90      health        visa-cal
  2026-01-15  סופר-פארם                -₪156.30     health        visa-cal

  Showing 7 of 142 transactions  |  Total: -₪12,430.60  |  Page 1/21
```

### Hebrew / RTL Text Handling

Terminal RTL support is inconsistent. Practical approach:

1. **Do NOT attempt full RTL layout** -- most terminals handle it poorly.
2. **Display Hebrew text LTR** in table cells -- this is how most Israeli CLI tools work. The Hebrew strings themselves render correctly due to Unicode BiDi algorithm within each cell.
3. **Left-align all columns** -- avoid right-alignment which interacts badly with BiDi.
4. **Provide a `--ltr` flag** (default: on) that wraps Hebrew text in LTR isolation characters (`U+2066` / `U+2069`) to prevent BiDi reordering from breaking table layout.
5. **Currency symbol**: Use `₪` (U+20AA) as suffix or prefix based on locale. Israeli convention: `₪247.50`.

### Currency Formatting

```typescript
// Format: ₪1,234.56 (Israeli convention)
// Negative: -₪1,234.56 (red in terminal)
// Positive: +₪1,234.56 (green in terminal)
// Foreign:  $150.00 (USD), €130.00 (EUR) -- show original + charged
```

### Date Formatting

```
--date-format iso       # 2026-01-15 (default for --json)
--date-format short     # 15/01/26  (Israeli convention DD/MM/YY)
--date-format long      # 15 בינואר 2026
--date-format relative  # 3 days ago
```

Default for human mode: `short` (DD/MM/YY). Default for JSON: ISO 8601.

### Summary Reports

```
$ finance report summary --month 2026-01

  January 2026 Financial Summary
  ══════════════════════════════════

  Income:        +₪18,500.00
  Expenses:      -₪12,430.60
  Net:           +₪6,069.40

  Top Categories:
    groceries    ₪2,180.00  ████████████████░░░░  17.5%
    rent         ₪4,500.00  ████████████████████████████████████  36.2%
    utilities    ₪890.00    ███████░░░░░░░░░░░░░   7.2%
    transport    ₪650.00    █████░░░░░░░░░░░░░░░   5.2%
    food         ₪1,240.00  ██████████░░░░░░░░░░  10.0%
    other        ₪2,970.60  ████████████████████████  23.9%

  vs. Last Month:
    Income:    ──  (no change)
    Expenses:  ▲ 8.3% (+₪950.20)
```

### Budget Status

```
$ finance budget status

  February 2026 Budget Status (27 of 28 days)
  ═════════════════════════════════════════════

  Category      Budget     Spent      Remaining   Status
  ──────────    ─────────  ─────────  ──────────  ──────
  groceries     ₪2,500     ₪2,180     ₪320        OK
  restaurants   ₪800       ₪920       -₪120       OVER
  transport     ₪600       ₪450       ₪150        OK
  utilities     ₪1,000     ₪890       ₪110        OK
  entertainment ₪500       ₪480       ₪20         WARNING

  Overall: ₪5,400 / ₪6,400 budget (84.4%)
  ⚠ 1 category over budget, 1 category near limit
```

---

## 6. Error UX

### Error Hierarchy

Errors should be categorized by **what the user can do about it**:

#### User-Actionable Errors (provide clear fix instructions)

```
$ finance fetch hapoalim

✗ Authentication failed for Bank Hapoalim.

  The username or password is incorrect, or your account may be locked.

  What to try:
  1. Verify your credentials: finance accounts test hapoalim
  2. Update saved credentials: finance accounts add hapoalim
  3. Check if your account is locked by logging in at https://www.bankhapoalim.co.il
  4. If using OTP, ensure your phone is accessible.

  Error code: AUTH_FAILED (exit code 3)
```

#### Transient Errors (suggest retry)

```
$ finance fetch leumi

✗ Connection timed out for Bank Leumi.

  The bank's website may be slow or temporarily unavailable.

  What to try:
  1. Wait a few minutes and retry: finance fetch leumi
  2. Check if the bank site is accessible in your browser.
  3. If this persists, the bank may be blocking automated access.

  Error code: TIMEOUT (exit code 4)
```

#### System Errors (provide diagnostic info)

```
$ finance fetch

✗ Chromium browser not found.

  The scraper requires a Chromium-based browser (Puppeteer).

  What to try:
  1. Run: npx puppeteer browsers install chrome
  2. Or set PUPPETEER_EXECUTABLE_PATH to your Chrome installation.

  Error code: BROWSER_MISSING (exit code 1)
```

### Machine-Readable Errors

```json
{
  "error": {
    "code": "AUTH_FAILED",
    "provider": "hapoalim",
    "message": "Authentication failed. Username or password incorrect.",
    "exitCode": 3,
    "retryable": false,
    "suggestions": [
      "Verify credentials with 'finance accounts test hapoalim'",
      "Update credentials with 'finance accounts add hapoalim'"
    ]
  }
}
```

### Partial Failure Reporting

When fetching from multiple providers, some may succeed while others fail:

```
$ finance fetch

  hapoalim   ✓  87 transactions
  leumi      ✓  52 transactions
  visa-cal   ✗  Authentication failed
  max        ✓  31 transactions

3 of 4 providers succeeded. 170 transactions fetched.

⚠ 1 provider failed. Run 'finance fetch visa-cal' to retry.
  visa-cal: Authentication failed (AUTH_FAILED)
```

Exit code: `10` (partial success).

JSON output includes both results and errors:

```json
{
  "results": [
    {"provider": "hapoalim", "status": "success", "transactions": 87},
    {"provider": "leumi", "status": "success", "transactions": 52},
    {"provider": "max", "status": "success", "transactions": 31}
  ],
  "errors": [
    {"provider": "visa-cal", "code": "AUTH_FAILED", "message": "..."}
  ],
  "summary": {
    "total": 170,
    "succeeded": 3,
    "failed": 1
  }
}
```

---

## 7. Onboarding (First-Run Experience)

### Auto-Detection

On first run of any command, detect that no config exists and offer guided setup:

```
$ finance

  Welcome to Israel Finance CLI! 🏦

  It looks like this is your first time running the tool.
  Let's get you set up in a few quick steps.

  ? How would you like to get started?
    > Quick Setup (add one provider now)
      Full Setup (configure everything)
      Skip (I'll set up later)
```

### Quick Setup Path

```
$ finance init

  Israel Finance CLI - Setup
  ══════════════════════════

  Step 1/3: Add a financial provider

  ? Select your first provider:
    > Bank Hapoalim
      Bank Leumi
      Visa Cal
      Max
      (see all 16 providers)

  ? Bank Hapoalim username: david_cohen
  ? Bank Hapoalim password: ••••••••

  Testing connection... ✓ Connected!

  Step 2/3: Default settings

  ? Transaction date format:
    > DD/MM/YY (Israeli)
      YYYY-MM-DD (ISO)

  ? Default fetch period:
    > Last 30 days
      Last 60 days
      Last 90 days

  Step 3/3: Data storage

  Transactions will be stored locally at:
    ~/.config/finance-cli/data/

  ? Save credentials to system keychain? (Y/n) Y

  ══════════════════════════

  Setup complete! Here's what you can do next:

  finance fetch             Fetch latest transactions
  finance transactions      View your transactions
  finance report summary    See a spending summary
  finance accounts add      Add another provider
  finance --help            See all commands

  Happy tracking!
```

### Non-Interactive Setup (for CI / AI Agents)

```bash
# One-liner setup via environment
export FINANCE_HAPOALIM_USERNAME=david_cohen
export FINANCE_HAPOALIM_PASSWORD=s3cur3p4ss
finance fetch --non-interactive

# Or via config file
finance config set providers.hapoalim.enabled true
finance config set defaults.fetchPeriod 30
finance config set defaults.dateFormat iso
```

---

## 8. Technology Recommendations

### CLI Framework

**Commander.js** for command parsing -- lightweight, mature, excellent TypeScript support, and follows patterns familiar to Node.js developers. Avoid heavier frameworks like oclif unless plugin support becomes a requirement.

### Interactive UI

**Inquirer.js** (`@inquirer/prompts`) for interactive prompts (setup wizard, OTP entry, confirmations). It supports password masking, select menus, checkboxes, and validation out of the box.

For richer terminal UI (progress bars, spinners, tables), consider **Ink** (React for CLI) with **@inkjs/ui** components. This allows building complex, updating terminal interfaces with a familiar component model.

### Output Formatting

- **cli-table3** or **tty-table** for aligned table output
- **chalk** for colored text
- **ora** for simple spinners (or Ink's `<Spinner>` for React-based approach)

### Credential Storage

- **keytar** (or its maintained fork) for OS keychain integration
- Fallback to encrypted file storage for environments without keychain

### Configuration

- **cosmiconfig** for config file discovery (~/.config/finance-cli/config.json, .financerc, etc.)
- Support config via: CLI flags > env vars > config file > defaults (standard precedence)

---

## 9. Summary of Key UX Decisions

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| Command style | `finance <resource> <action>` | Follows gh/docker patterns; scales well |
| Machine output | `--json` flag on all commands | Industry standard; gh, stripe, npm all do this |
| Credential storage | OS keychain (primary), env vars (CI) | Secure by default, flexible for automation |
| 2FA handling | Interactive OTP prompt + long-term token option | Matches israeli-bank-scrapers API |
| Progress display | Multi-provider parallel progress (Ink) | Users need feedback during 30-60s scrapes |
| Hebrew text | LTR layout with BiDi isolation chars | Best terminal compatibility |
| Error format | Categorized with actionable suggestions | Reduces user frustration |
| First-run | Auto-detected guided wizard | Low friction onboarding |
| Date format | DD/MM/YY human, ISO machine | Israeli convention for humans |
| Currency | ₪ prefix, comma thousands | Israeli convention |
