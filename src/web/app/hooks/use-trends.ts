// Trend hooks — total, per-category, and fixed/variable analysis
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { TrendTotal, CategoryTrend, FixedVariableMonth } from "@/types/api";

export function useTotalTrends(months: number, exclude?: string[]) {
  return useQuery({
    queryKey: queryKeys.trends.total(months, exclude),
    queryFn: () => {
      const params = new URLSearchParams({ months: String(months) });
      if (exclude) params.set("exclude", exclude.join(","));
      return api.get<TrendTotal[]>(`/api/v2/trends/total?${params.toString()}`);
    },
  });
}

export function useCategoryTrend(category: string, months: number, exclude?: string[]) {
  return useQuery({
    queryKey: queryKeys.trends.category(category, months, exclude),
    queryFn: () => {
      const params = new URLSearchParams({ category, months: String(months) });
      if (exclude) params.set("exclude", exclude.join(","));
      return api.get<CategoryTrend[]>(`/api/v2/trends/category?${params.toString()}`);
    },
    enabled: !!category,
  });
}

export function useFixedVariable(months: number, exclude?: string[]) {
  return useQuery({
    queryKey: queryKeys.trends.fixedVariable(months, exclude),
    queryFn: () => {
      const params = new URLSearchParams({ months: String(months) });
      if (exclude) params.set("exclude", exclude.join(","));
      return api.get<FixedVariableMonth[]>(`/api/v2/trends/fixed-variable?${params.toString()}`);
    },
  });
}
