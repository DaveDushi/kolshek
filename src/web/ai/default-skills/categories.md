Transaction categorization knowledge.

## Classification System
Categories have classifications that control how they're treated in reports:
- expense: regular spending (groceries, restaurants, bills)
- income: earnings (salary, freelance, interest)
- cc_billing: credit card bill payments — these are internal transfers between bank and CC, NOT real expenses. Always exclude from spending analysis.
- transfer: money movement between own accounts (Bit transfers to self, etc.)
- investment: investment purchases/deposits
- debt: loan payments
- savings: savings deposits

## Common Israeli Categories
Groceries, Restaurants, Transportation, Fuel, Healthcare, Insurance, Utilities, Rent/Housing, Education, Childcare, Entertainment, Shopping, Fashion, Subscriptions, Telecommunications, Government/Taxes, Salary, Freelance

## When Analyzing Categories
- Always exclude cc_billing and transfer from expense totals — they're not real spending
- Uncategorized transactions (category IS NULL or '') should be noted but not ignored
- Check categories table: `SELECT name, classification FROM categories`
- Category rules auto-assign categories based on description patterns

## SQL for Category Analysis
- Spending by category: use the category_report tool
- Uncategorized count: `SELECT COUNT(*) FROM transactions WHERE category IS NULL OR category = ''`
- Top merchants in a category: `SELECT description, COUNT(*), SUM(ABS(charged_amount)) FROM transactions WHERE category = 'X' GROUP BY description ORDER BY 3 DESC`
