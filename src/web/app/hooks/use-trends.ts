// Trend hooks — total, per-category, and fixed/variable analysis
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { TrendTotal, CategoryTrend, FixedVariableMonth } from "@/types/api";

export function useTotalTrends(months: number) {
  return useQuery({
    queryKey: queryKeys.trends.total(months),
    queryFn: () =>
      api.get<TrendTotal[]>(`/api/v2/trends/total?months=${months}`),
  });
}

export function useCategoryTrend(category: string, months: number) {
  return useQuery({
    queryKey: queryKeys.trends.category(category, months),
    queryFn: () =>
      api.get<CategoryTrend[]>(
        `/api/v2/trends/category?category=${encodeURIComponent(category)}&months=${months}`
      ),
    enabled: !!category,
  });
}

export function useFixedVariable(months: number) {
  return useQuery({
    queryKey: queryKeys.trends.fixedVariable(months),
    queryFn: () =>
      api.get<FixedVariableMonth[]>(
        `/api/v2/trends/fixed-variable?months=${months}`
      ),
  });
}
