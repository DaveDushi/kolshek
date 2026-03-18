// Provider hooks — CRUD for bank/credit-card providers
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { ProviderCard } from "@/types/api";

export function useProviders() {
  return useQuery({
    queryKey: queryKeys.providers.list(),
    queryFn: () => api.get<ProviderCard[]>("/api/v2/providers"),
  });
}

export function useProviderFields(companyId: string) {
  return useQuery({
    queryKey: queryKeys.providers.fields(companyId),
    queryFn: () =>
      api.get<{ loginFields: string[] }>(
        `/api/v2/providers/fields/${encodeURIComponent(companyId)}`
      ),
    enabled: !!companyId,
  });
}

export function useCreateProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      companyId: string;
      alias: string;
      credentials: Record<string, string>;
    }) => api.post<ProviderCard>("/api/v2/providers", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.providers.all });
    },
  });
}

export function useDeleteProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/api/v2/providers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.providers.all });
    },
  });
}

export function useUpdateAuth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      credentials,
    }: {
      id: number;
      credentials: Record<string, string>;
    }) => api.post(`/api/v2/providers/${id}/auth`, { credentials }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.providers.all });
    },
  });
}
