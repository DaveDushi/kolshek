// Consistent query key factory for TanStack Query
export const queryKeys = {
  providers: {
    all: ["providers"] as const,
    list: () => [...queryKeys.providers.all, "list"] as const,
    fields: (companyId: string) => [...queryKeys.providers.all, "fields", companyId] as const,
  },
  accounts: {
    all: ["accounts"] as const,
    balance: () => [...queryKeys.accounts.all, "balance"] as const,
  },
  transactions: {
    all: ["transactions"] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.transactions.all, "list", filters] as const,
    detail: (id: number) => [...queryKeys.transactions.all, "detail", id] as const,
  },
  categories: {
    all: ["categories"] as const,
    summary: () => [...queryKeys.categories.all, "summary"] as const,
    list: () => [...queryKeys.categories.all, "list"] as const,
    transactions: (cat: string) => [...queryKeys.categories.all, "tx", cat] as const,
    rules: () => [...queryKeys.categories.all, "rules"] as const,
    classifications: () => [...queryKeys.categories.all, "classifications"] as const,
  },
  translations: {
    all: ["translations"] as const,
    untranslated: () => [...queryKeys.translations.all, "untranslated"] as const,
    translated: () => [...queryKeys.translations.all, "translated"] as const,
    rules: () => [...queryKeys.translations.all, "rules"] as const,
  },
  reports: {
    all: ["reports"] as const,
    monthly: (from: string, to: string) => [...queryKeys.reports.all, "monthly", from, to] as const,
    categories: (from: string, to: string) => [...queryKeys.reports.all, "categories", from, to] as const,
    balance: () => [...queryKeys.reports.all, "balance"] as const,
  },
  spending: {
    all: ["spending"] as const,
    report: (month: string, groupBy: string, exclude?: string[]) =>
      [...queryKeys.spending.all, "report", month, groupBy, exclude ?? null] as const,
  },
  income: {
    all: ["income"] as const,
    report: (month: string) => [...queryKeys.income.all, "report", month] as const,
  },
  trends: {
    all: ["trends"] as const,
    total: (months: number, exclude?: string[]) =>
      [...queryKeys.trends.all, "total", months, exclude ?? null] as const,
    category: (cat: string, months: number, exclude?: string[]) =>
      [...queryKeys.trends.all, "category", cat, months, exclude ?? null] as const,
    fixedVariable: (months: number, exclude?: string[]) =>
      [...queryKeys.trends.all, "fixed-variable", months, exclude ?? null] as const,
  },
  insights: {
    all: ["insights"] as const,
    list: (months: number, exclude?: string[]) =>
      [...queryKeys.insights.all, "list", months, exclude ?? null] as const,
  },
  reconciliation: {
    all: ["reconciliation"] as const,
    duplicates: (filters: Record<string, unknown>) =>
      [...queryKeys.reconciliation.all, "duplicates", filters] as const,
    history: (filters: Record<string, unknown>) =>
      [...queryKeys.reconciliation.all, "history", filters] as const,
  },
};
