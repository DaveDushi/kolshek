---
name: budgeting
description: Budget tracking, monthly review patterns, savings rate analysis, and spending optimization.
tier: knowledge
---
Budget tracking and monthly review patterns.

## Monthly Review Process
1. Compare current month vs previous month spending by category
2. Identify categories with significant changes (>20% increase)
3. Flag new merchants not seen in previous months
4. Check for large one-time transactions that skew averages
5. Calculate savings rate: (income - expenses) / income * 100

## Budget Health Indicators
- Savings rate: >20% excellent, 10-20% good, 0-10% needs attention, <0% deficit
- Mandatory spending >60% of income = structurally constrained
- Discretionary spending >30% = room for optimization
- Fixed costs growing month-over-month = investigate subscription creep

## Savings Opportunities
- Duplicate subscriptions: same category, similar small amounts, multiple merchants
- Spending frequency: >10 restaurant transactions/month may indicate habit worth examining
- Price comparison: similar merchants with different average amounts
- Seasonal patterns: compare same month previous year if data available

## Useful Comparisons
- Month-over-month: `monthly_report` tool with consecutive months
- Category trends: same category across months via query tool
- Merchant frequency: `GROUP BY description, strftime('%Y-%m', date)` to see visit patterns
- Weekend vs weekday spending patterns
