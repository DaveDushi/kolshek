// Reconciliation hooks — duplicates, decisions, balance check, history
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type {
  DuplicatesResponse,
  ReconciliationRecordApi,
  BalanceReconciliationApi,
} from "@/types/api";

// -- Queries --

export function useDuplicateCandidates(filters: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: queryKeys.reconciliation.duplicates(filters),
    queryFn: () => {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(filters)) {
        if (v !== undefined && v !== null && v !== "") {
          params.set(k, String(v));
        }
      }
      const qs = params.toString();
      return api.get<DuplicatesResponse>(
        `/api/v2/reconciliation/duplicates${qs ? `?${qs}` : ""}`
      );
    },
  });
}

export function useReconcileHistory(filters: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: queryKeys.reconciliation.history(filters),
    queryFn: () => {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(filters)) {
        if (v !== undefined && v !== null && v !== "") {
          params.set(k, String(v));
        }
      }
      const qs = params.toString();
      return api.get<ReconciliationRecordApi[]>(
        `/api/v2/reconciliation/history${qs ? `?${qs}` : ""}`
      );
    },
  });
}

// -- Mutations --

export function useReconcileDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      txIdA: number;
      txIdB: number;
      decision: "merged" | "dismissed";
      keepTxId?: number;
    }) => api.post<ReconciliationRecordApi>("/api/v2/reconciliation/decide", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.reconciliation.all });
      qc.invalidateQueries({ queryKey: queryKeys.transactions.all });
    },
  });
}

export function useBalanceCheck() {
  return useMutation({
    mutationFn: (body: {
      accountId: number;
      expectedBalance: number;
      from?: string;
      to?: string;
    }) =>
      api.post<BalanceReconciliationApi>(
        "/api/v2/reconciliation/balance",
        body
      ),
  });
}
