// Canonical currency symbol -> ISO 4217 mapping.
// israeli-bank-scrapers-core sometimes returns symbols instead of codes.

export const SYMBOL_TO_ISO: Record<string, string> = {
  "\u20AA": "ILS",
  "$": "USD",
  "\u20AC": "EUR",
  "\u00A3": "GBP",
};

export function normalizeCurrency(raw: string): string {
  return SYMBOL_TO_ISO[raw] || raw;
}
