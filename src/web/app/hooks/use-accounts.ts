// Account hooks — balance report
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { BalanceRow } from "@/types/api";

export function useBalanceReport() {
  return useQuery({
    queryKey: queryKeys.accounts.balance(),
    queryFn: () => api.get<BalanceRow[]>("/api/v2/accounts/balance"),
  });
}
