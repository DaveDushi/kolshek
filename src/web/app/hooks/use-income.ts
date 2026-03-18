// Income hooks — income breakdown for a given month
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { IncomeResult } from "@/types/api";

export function useIncome(month: string) {
  return useQuery({
    queryKey: queryKeys.income.report(month),
    queryFn: () =>
      api.get<IncomeResult>(
        `/api/v2/income?month=${encodeURIComponent(month)}`
      ),
  });
}
