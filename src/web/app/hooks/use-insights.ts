// Insights hooks — anomaly detection and smart alerts
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { Insight } from "@/types/api";

export function useInsights(months?: number, exclude?: string[]) {
  // Default to 3 months if not specified
  const m = months ?? 3;
  return useQuery({
    queryKey: queryKeys.insights.list(m, exclude),
    queryFn: () => {
      const params = new URLSearchParams({ months: String(m) });
      if (exclude) params.set("exclude", exclude.join(","));
      return api.get<Insight[]>(`/api/v2/insights?${params.toString()}`);
    },
  });
}
