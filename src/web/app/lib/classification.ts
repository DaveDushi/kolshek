// Shared classification utilities — colors, labels, defaults.
// Used by ClassificationPanel, ClassificationFilter, and ClassificationBadge.

import type { BuiltinClassification } from "@/types/api";

export const BUILTIN: { value: BuiltinClassification; label: string; color: string }[] = [
  { value: "expense", label: "Expense", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  { value: "income", label: "Income", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  { value: "cc_billing", label: "CC Billing", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  { value: "transfer", label: "Transfer", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  { value: "investment", label: "Investment", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  { value: "debt", label: "Debt", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  { value: "savings", label: "Savings", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400" },
];

// Extra color palette for custom classifications — deterministic by name hash
const CUSTOM_COLORS: { bg: string; text: string; dot: string }[] = [
  { bg: "bg-rose-100 dark:bg-rose-900/30", text: "text-rose-700 dark:text-rose-400", dot: "bg-rose-500" },
  { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
  { bg: "bg-lime-100 dark:bg-lime-900/30", text: "text-lime-700 dark:text-lime-400", dot: "bg-lime-500" },
  { bg: "bg-teal-100 dark:bg-teal-900/30", text: "text-teal-700 dark:text-teal-400", dot: "bg-teal-500" },
  { bg: "bg-sky-100 dark:bg-sky-900/30", text: "text-sky-700 dark:text-sky-400", dot: "bg-sky-500" },
  { bg: "bg-violet-100 dark:bg-violet-900/30", text: "text-violet-700 dark:text-violet-400", dot: "bg-violet-500" },
  { bg: "bg-fuchsia-100 dark:bg-fuchsia-900/30", text: "text-fuchsia-700 dark:text-fuchsia-400", dot: "bg-fuchsia-500" },
  { bg: "bg-pink-100 dark:bg-pink-900/30", text: "text-pink-700 dark:text-pink-400", dot: "bg-pink-500" },
  { bg: "bg-indigo-100 dark:bg-indigo-900/30", text: "text-indigo-700 dark:text-indigo-400", dot: "bg-indigo-500" },
  { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-400", dot: "bg-yellow-500" },
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function customColor(name: string): { bg: string; text: string; dot: string } {
  return CUSTOM_COLORS[hashString(name) % CUSTOM_COLORS.length];
}

export function classificationColor(classification: string): string {
  const builtin = BUILTIN.find((b) => b.value === classification);
  if (builtin) return builtin.color;
  const c = customColor(classification);
  return `${c.bg} ${c.text}`;
}

export function classificationDot(classification: string): string {
  const builtin = BUILTIN.find((b) => b.value === classification);
  if (builtin) return builtin.color.split(" ")[0];
  return customColor(classification).dot;
}

export function classificationLabel(classification: string): string {
  return BUILTIN.find((b) => b.value === classification)?.label ?? classification;
}

// Page-specific default exclusion lists (mirrors CLI defaults)
export const SPENDING_DEFAULT_EXCLUDES: string[] = ["cc_billing", "transfer", "income"];
export const REPORT_DEFAULT_EXCLUDES: string[] = ["cc_billing"];
