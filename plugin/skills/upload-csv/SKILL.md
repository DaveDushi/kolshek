---
name: upload-csv
description: >
  Import transactions from any bank's CSV export (Chase, Bank of America,
  Wells Fargo, Amex, Capital One, etc.) by auto-mapping columns to KolShek format.
  Use when: upload CSV, import CSV, convert CSV, Chase CSV, bank CSV,
  foreign bank CSV, map CSV columns, reformat CSV for import.
compatibility: Requires KolShek CLI (kolshek) installed and configured.
metadata:
  author: kolshek
  version: "0.4.5"
allowed-tools: Bash Read Write AskUserQuestion
---

# /kolshek:upload-csv

You are helping the user import transactions from **any bank's CSV export** into KolShek. The source CSV will NOT be in KolShek format — your job is to analyze it, map the columns, transform the data, and import it.

## Before You Start

Read `references/cli-reference.md` for the complete command reference, DB schema, and conventions.

## KolShek CSV Format

KolShek requires these **5 columns** (header names must match exactly):

| Column | Type | Description |
|--------|------|-------------|
| `date` | string | Transaction date (YYYY-MM-DD or DD/MM/YYYY) |
| `description` | string | Merchant / transaction description |
| `charged_amount` | number | Amount in account currency (**negative = debit, positive = credit**) |
| `provider` | string | Provider company ID or alias (e.g., `chase`, `bofa`, `amex`) |
| `account_number` | string | Account number or last 4 digits |

**Optional columns** (include if data is available):
`charged_currency`, `original_amount`, `original_currency`, `processed_date`, `status`, `type`, `memo`, `category`, `description_en`, `identifier`, `installment_number`, `installment_total`, `provider_type`

> **Note:** If the provider doesn't exist in KolShek yet, it will be **auto-created** during import. Set `provider_type` to `bank` or `credit_card` to control the type (defaults to `bank` if omitted).

## Step 1: Identify the CSV File

Ask the user for the file path:

> What CSV file would you like to import? Provide the full path.

Or, if the user already provided a path, use that directly.

Read the file to inspect its contents. Read the **first 20 lines** to understand the format.

## Step 2: Analyze the Source Format

Examine the CSV structure:
- What delimiter is used? (comma, tab, semicolon, pipe)
- Is there a header row? What are the column names?
- Are there metadata/summary rows before the actual data? (Chase and Amex CSVs often have these)
- What date format is used? (MM/DD/YYYY, YYYY-MM-DD, DD/MM/YYYY, etc.)
- How are amounts represented? (single column with +/-, separate debit/credit columns, always positive with a type column, etc.)
- Is there a currency column? What currency?
- Are there any special characters or encoding issues?

Present your analysis:

> **Source CSV Analysis**
>
> | Property | Value |
> |----------|-------|
> | Delimiter | comma |
> | Header row | Row 1 (after 3 metadata rows) |
> | Columns | Transaction Date, Post Date, Description, Category, Type, Amount, Memo |
> | Date format | MM/DD/YYYY |
> | Amount format | Single column, negative = debit |
> | Currency | USD (implied) |
> | Rows | ~150 data rows |

## Step 3: Build the Column Mapping

Map source columns to KolShek columns. Present the mapping for user approval:

> **Column Mapping**
>
> | KolShek Column | Source Column | Transform |
> |----------------|--------------|-----------|
> | `date` | Transaction Date | MM/DD/YYYY -> YYYY-MM-DD |
> | `description` | Description | as-is |
> | `charged_amount` | Amount | as-is (already negative for debits) |
> | `provider` | *(constant)* | `chase` |
> | `account_number` | *(constant)* | will ask user |
> | `category` | Category | as-is |
> | `memo` | Memo | as-is |
> | `charged_currency` | *(constant)* | `USD` |
>
> Does this mapping look correct?

Ask the user for any missing required values:
- **Provider name**: suggest a sensible default based on the filename or content (e.g., `chase`, `bofa`, `amex`, `wells-fargo`, `capital-one`). This becomes the provider alias in KolShek. The provider will be **auto-created** if it doesn't exist — no need to run `kolshek providers add` first.
- **Provider type**: include the `provider_type` column with value `bank` or `credit_card` so the auto-created provider gets the correct type.
- **Account number**: ask the user — check if it appears in the CSV metadata rows first.
- **Currency**: default to USD for US banks, EUR for European, etc.

### Common Bank CSV Quirks

**Chase**: Has metadata rows at top. Amount is negative for purchases, positive for payments/credits. "Type" column has Sale/Payment/Return. Category column is useful.

**Bank of America**: May have separate "Amount" column where debits are negative. Date format MM/DD/YYYY.

**Wells Fargo**: Simple format with Date, Amount, *, *, Description. No header row sometimes — detect by checking if first row looks like data.

**Amex**: May have header rows to skip. "Amount" is positive for charges (needs negation for KolShek). "Date" might be in MM/DD/YYYY or DD/MM/YYYY.

**Capital One**: "Debit" and "Credit" in separate columns — combine into single `charged_amount` (negate debit, keep credit positive).

**Generic**: If you can't identify the bank, ask the user to confirm the mapping. Look for columns containing "date", "amount", "description", "merchant", "memo", "category", "debit", "credit", "transaction" (case-insensitive).

### Amount Sign Convention

KolShek convention: **negative = money out (expense), positive = money in (income)**.

- If the source uses positive for expenses: negate them
- If the source has separate debit/credit columns: `charged_amount = credit - debit` (treating empty as 0)
- If the source has a "type" column (debit/credit): use it to determine sign

**Always confirm the sign convention with the user** by showing a sample row:

> Row 1: "WALMART" charged $52.30 — this will import as **-52.30** (expense). Correct?

## Step 4: Generate the KolShek CSV

Write a transformation script or manually build the output CSV. Write the result to a temporary file.

The output must:
1. Have the exact KolShek header row
2. Skip metadata/summary rows from the source
3. Convert dates to YYYY-MM-DD format
4. Apply the amount sign convention
5. Fill in constant values (provider, account_number, currency)
6. Properly escape CSV fields containing commas or quotes
7. Map any optional columns that have data (category, memo, etc.)

Write the converted CSV to a temp file, e.g., `kolshek-import-{provider}-{timestamp}.csv` in the same directory as the source file.

## Step 5: Preview

Run a dry-run import to validate:

```
kolshek import csv <output-file> --dry-run --json
```

Present the results:

> **Import Preview**
>
> - Valid rows: 147
> - Errors: 3 (rows 45, 89, 102 — invalid dates)
> - Provider: chase
> - Account: 4567
> - Date range: 2025-01-01 to 2025-03-15
>
> Sample transactions:
> | Date | Description | Amount | Category |
> |------|-------------|--------|----------|
> | 2025-01-02 | WALMART SUPERCENTER | -52.30 | Shopping |
> | 2025-01-03 | STARBUCKS | -6.45 | Food & Drink |
> | 2025-01-05 | PAYROLL DEPOSIT | 3,200.00 | |

If there are errors, offer to fix them or use `--skip-errors`.

## Step 6: Import

After user approval:

```
kolshek import csv <output-file> --json
```

Or with error skipping if needed:

```
kolshek import csv <output-file> --skip-errors --json
```

Report results:

> **Import Complete**
>
> - Imported: 147 transactions
> - Skipped: 3 (errors)
> - Provider: chase (auto-created)
> - Account: 4567
> - Date range: 2025-01-01 to 2025-03-15
>
> The converted CSV is saved at: `./kolshek-import-chase-20260326.csv`
> You can delete it or keep it as a backup.

## Step 7: Post-Import

Suggest next steps:

> **What's next?**
> - `/kolshek:translate` — translate any Hebrew descriptions to English
> - `/kolshek:categorize` — set up category rules for the new transactions
> - `kolshek spending` — see your spending breakdown
> - Upload another CSV with `/kolshek:upload-csv`
