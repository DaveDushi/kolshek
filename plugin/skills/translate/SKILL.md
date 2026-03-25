---
name: translate
description: Translate Hebrew transaction descriptions to English for better readability and categorization. Use when user asks to translate, transliterate, or convert Hebrew merchant names to English in KolShek.
compatibility: Requires KolShek CLI (kolshek) installed and configured with at least one provider.
metadata:
  author: kolshek
  version: "0.4.3"
allowed-tools: Bash Read AskUserQuestion
---

# /kolshek:translate

You are helping the user translate their Hebrew transaction descriptions to English.

## Before You Start

Read `references/cli-reference.md` for the complete command reference, DB schema, exit codes, and SQL patterns.

Run startup checks:
1. `kolshek providers list --json` — if empty, guide user to `kolshek providers add`.
2. `kolshek transactions list --limit 1 --json` — if empty, offer to fetch.
3. `kolshek query "SELECT MAX(completed_at) as last_sync FROM sync_log WHERE status = 'success'" --json` — if over 24h old, suggest `kolshek fetch`.

## Step 1: Seed Built-In Dictionary

Check if translations have been seeded already:
```
kolshek translate rule list --json
```

If no rules exist, seed the built-in merchant dictionary first:
```
kolshek translate seed --json
```

Report how many rules were seeded.

## Step 2: Find Untranslated Descriptions

Get all unique descriptions that don't have a matching translation rule:

```
kolshek query "SELECT DISTINCT description FROM transactions WHERE description IS NOT NULL ORDER BY description" --json
```

Cross-reference with existing rules from `kolshek translate rule list --json`. Identify descriptions not yet covered by any rule.

## Step 3: Generate Translations

For each untranslated description, generate an English translation (you can read Hebrew). Group them into a table:

> Here are the translations I've prepared:
>
> | Hebrew | English |
> |--------|---------|
> | שופרסל דיל | Shufersal Deal (supermarket) |
> | קפה גרג | Cafe Greg |
> | העברה בביט | Bit Transfer |
> | משכורת | Salary |
> | ... | ... |
>
> Look good? You can suggest changes, remove entries, or approve.

## Step 4: Apply

Let the user review — they can approve all, request changes to specific ones, or skip entries.

For each approved translation:
```
kolshek translate rule add "<english>" --match "<hebrew>" --json
```

For bulk operations, you can also use:
```
kolshek translate rule import rules.json --json
```

Then apply all rules:
```
kolshek translate apply --json
```

Report how many transactions were translated.

## Step 5: Done

> Translated N transactions.
> You now have Z translation rules. Add more anytime with `kolshek translate rule add "<english>" --match "<hebrew>"`.
