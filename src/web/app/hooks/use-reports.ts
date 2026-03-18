// Report hooks — monthly income/expense report
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { MonthlyReport } from "@/types/api";

export function useMonthlyReport(from: string, to: string) {
  return useQuery({
    queryKey: queryKeys.reports.monthly(from, to),
    queryFn: () =>
      api.get<MonthlyReport[]>(
        `/api/v2/reports/monthly?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      ),
  });
}
