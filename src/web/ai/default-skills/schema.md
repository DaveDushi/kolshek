---
name: schema
description: Database schema — tables, columns, joins, and query patterns
tier: knowledge
---

## Tables

providers(id PK, company_id, alias UNIQUE, display_name, type bank|credit_card, last_synced_at, created_at)
accounts(id PK, provider_id→providers, account_number, display_name, balance, currency='ILS', created_at)
transactions(id PK, account_id→accounts, type normal|installments, identifier, date, processed_date, original_amount, original_currency, charged_amount, charged_currency, description, description_en, memo, status completed|pending, installment_number, installment_total, category, hash, unique_id, created_at, updated_at)
categories(name PK, classification='expense', created_at)
category_rules(id PK, category, conditions JSON, priority=0, created_at)
translation_rules(id PK, english_name, match_pattern, created_at)
sync_log(id PK, provider_id→providers, started_at, completed_at, status running|success|error, transactions_added=0, transactions_updated=0, error_message, scrape_start_date, scrape_end_date)
spending_excludes(category PK, created_at)

## Key Joins

transactions.account_id → accounts.id → accounts.provider_id → providers.id

## Notes

- Uncategorized: category IS NULL OR category = '' OR category = 'uncategorized'
- Descriptions may be Hebrew — description_en has translations
- charged_amount is in ILS, original_amount may be foreign currency
