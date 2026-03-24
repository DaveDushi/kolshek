---
name: hebrew
description: Hebrew transaction description handling, common merchant patterns, and bilingual query tips.
tier: knowledge
---
Hebrew transaction description handling.

## Description Fields
- `description`: original Hebrew text from the bank/credit card
- `description_en`: English translation (NULL if not yet translated)
- Always prefer `description_en` when available: `COALESCE(description_en, description)`

## Common Hebrew Merchant Patterns
Israeli bank descriptions often include:
- Merchant name in Hebrew + branch/location
- "הוראת קבע" = standing order (recurring payment)
- "העברה" = transfer
- "משכורת" = salary
- "ביט"/"פייבוקס" = Bit/PayBox mobile payment apps
- "סופר"/"מרקט" = supermarket
- "דלק" = fuel/gas station
- "ארנונה" = municipal property tax
- "חשמל" = electricity
- "מים" = water

## Query Tips
- Search with Hebrew: `search_transactions` handles Hebrew text
- Fuzzy matching: `WHERE description LIKE '%keyword%'` works for partial Hebrew
- Group by description to find recurring merchants
- When translating results for the user, provide both Hebrew and English names
