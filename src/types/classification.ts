// Category classification types.
// Classifications carry semantic meaning about what kind of financial
// activity a category represents. They control which categories appear
// in reports, spending, and insights.

// Built-in classifications that have special treatment in queries.
export const BUILTIN_CLASSIFICATIONS = [
  "expense",
  "income",
  "cc_billing",
  "transfer",
  "investment",
  "debt",
  "savings",
] as const;

export type BuiltinClassification = (typeof BUILTIN_CLASSIFICATIONS)[number];

// Classification is either a built-in type or a user-defined string.
export type Classification = BuiltinClassification | (string & {});

// Default exclusions per reporting context.
export const DEFAULT_SPENDING_EXCLUDES: readonly string[] = [
  "cc_billing",
  "transfer",
  "income",
];

export const DEFAULT_INCOME_EXCLUDES: readonly string[] = ["cc_billing"];

export const DEFAULT_REPORT_EXCLUDES: readonly string[] = ["cc_billing"];

// Validate that a string is a valid classification name (lowercase alphanumeric + underscores).
export function isValidClassification(value: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(value) && value.length <= 50;
}

// Infer a default classification from transaction direction.
export function inferClassification(
  chargedAmount: number,
): BuiltinClassification {
  return chargedAmount > 0 ? "income" : "expense";
}
