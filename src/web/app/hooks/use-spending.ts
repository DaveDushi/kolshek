// Spending hooks — spending breakdown by category or merchant
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { SpendingItem, SpendingResult } from "@/types/api";

export function useSpending(
  month: string,
  groupBy: string,
  lifestyle?: boolean
) {
  return useQuery({
    queryKey: queryKeys.spending.report(month, groupBy),
    queryFn: async (): Promise<SpendingItem[]> => {
      const params = new URLSearchParams({ month, groupBy });
      if (lifestyle !== undefined) {
        params.set("lifestyle", String(lifestyle));
      }
      const result = await api.get<SpendingResult>(`/api/v2/spending?${params.toString()}`);
      // Transform backend shape to frontend SpendingItem[]
      return result.groups.map((g) => ({
        name: g.label,
        amount: g.totalAmount,
        count: g.transactionCount,
        percentage: g.percentage,
      }));
    },
  });
}
