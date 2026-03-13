// Pure income classification logic — no DB or CLI imports.

export type IncomeType = "salary" | "transfer" | "refund" | "other";

const SALARY_PATTERNS = [/salary/i, /wages?/i, /payroll/i, /משכורת/, /שכר\s*עבודה/, /שכר/];
const REFUND_PATTERNS = [/refund/i, /return/i, /החזר/, /זיכוי/];

export function classifyIncome(
  description: string,
  category: string | null,
  providerType: string,
): IncomeType {
  const text = `${description} ${category ?? ""}`;
  if (providerType === "credit_card") return "refund";
  if (SALARY_PATTERNS.some((p) => p.test(text))) return "salary";
  if (REFUND_PATTERNS.some((p) => p.test(text))) return "refund";
  return "other";
}
