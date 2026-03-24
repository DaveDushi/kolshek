// Account hooks — balance report + exclusion toggle
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { BalanceRow } from "@/types/api";

export function useBalanceReport() {
  return useQuery({
    queryKey: queryKeys.accounts.balance(),
    queryFn: () => api.get<BalanceRow[]>("/api/v2/accounts/balance"),
  });
}

export function useToggleAccountExclusion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, excluded }: { accountId: number; excluded: boolean }) =>
      api.patch(`/api/v2/accounts/${accountId}`, { excluded }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.accounts.balance() });
    },
  });
}
