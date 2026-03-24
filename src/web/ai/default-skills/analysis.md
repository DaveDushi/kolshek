---
name: analysis
description: Patterns for analyzing Israeli bank/credit card income, expenses, installments, and financial trends.
tier: knowledge
---
Financial analysis patterns for Israeli bank/credit card data.

## Income Analysis
- Salary typically appears as positive amounts from bank accounts (provider type = "bank")
- Recurring income: same source appearing in multiple months with similar amounts = fixed income
- One-time income: appears once or amounts vary significantly
- Income types: salary, freelance, transfers (Bit/PayBox), refunds, interest, government benefits

## Expense Analysis
- Mandatory: housing/rent, groceries, utilities, healthcare, transportation, insurance, education
- Discretionary: restaurants, entertainment, shopping, fashion, subscriptions, travel, gifts
- Fixed costs: same merchant + similar amount recurring monthly (rent, subscriptions, insurance)
- Variable costs: fluctuating amounts (groceries, restaurants, fuel)

## Installments (תשלומים)
- Israeli credit cards commonly split purchases into installments
- Fields: installment_number (current), installment_total (total payments)
- Monthly installment burden = sum of all active installment payments
- Installments ending soon = freed-up future budget

## Common SQL Patterns
- Monthly spending: `SELECT strftime('%Y-%m', date) as month, SUM(ABS(charged_amount)) FROM transactions WHERE charged_amount < 0 GROUP BY month`
- Recurring merchants: `GROUP BY description HAVING COUNT(DISTINCT strftime('%Y-%m', date)) >= 3`
- Category breakdown: use the category_report tool for pre-built reports
- Exclude internal transfers: `WHERE category NOT IN (SELECT name FROM categories WHERE classification IN ('cc_billing', 'transfer'))`

## Israeli Financial Context
- Credit card billing cycles: charges from previous month appear on bank statement
- cc_billing classification marks credit card bill payments (internal transfers, not real expenses)
- Multiple providers common: checking account (bank) + 1-2 credit cards
- Shekel amounts: use ₪ symbol, format as ₪X,XXX
