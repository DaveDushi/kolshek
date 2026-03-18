// Category hooks — summary, CRUD, rules, and apply
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type {
  CategorySummary,
  CategoryRule,
  TransactionWithContext,
  ClassificationMap,
} from "@/types/api";

// -- Queries --

export function useCategorySummary() {
  return useQuery({
    queryKey: queryKeys.categories.summary(),
    queryFn: () =>
      api.get<CategorySummary[]>("/api/v2/categories/summary"),
  });
}

export function useCategoryList() {
  return useQuery({
    queryKey: queryKeys.categories.list(),
    queryFn: () => api.get<string[]>("/api/v2/categories/all"),
  });
}

export function useCategoryTransactions(category: string) {
  return useQuery({
    queryKey: queryKeys.categories.transactions(category),
    queryFn: () =>
      api.get<TransactionWithContext[]>(
        `/api/v2/categories/transactions?cat=${encodeURIComponent(category)}`
      ),
    enabled: !!category,
  });
}

export function useCategoryRules() {
  return useQuery({
    queryKey: queryKeys.categories.rules(),
    queryFn: () => api.get<CategoryRule[]>("/api/v2/categories/rules"),
  });
}

// -- Mutations --

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string }) =>
      api.post("/api/v2/categories", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.categories.all });
    },
  });
}

export function useRenameCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, newName }: { name: string; newName: string }) =>
      api.post(`/api/v2/categories/${encodeURIComponent(name)}/rename`, {
        newName,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.categories.all });
      qc.invalidateQueries({ queryKey: queryKeys.transactions.all });
    },
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api.post(`/api/v2/categories/${encodeURIComponent(name)}/delete`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.categories.all });
      qc.invalidateQueries({ queryKey: queryKeys.transactions.all });
    },
  });
}

export function useAddCategoryRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { category: string; conditions: Record<string, unknown>; priority?: number }) =>
      api.post("/api/v2/categories/rules", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.categories.rules() });
    },
  });
}

export function useRemoveCategoryRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api.delete(`/api/v2/categories/rules/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.categories.rules() });
    },
  });
}

// -- Classification hooks --

export function useClassificationMap() {
  return useQuery({
    queryKey: queryKeys.categories.classifications(),
    queryFn: () => api.get<ClassificationMap>("/api/v2/categories/classifications"),
  });
}

export function useSetClassification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, classification }: { name: string; classification: string }) =>
      api.put<{ name: string; classification: string }>(
        `/api/v2/categories/${encodeURIComponent(name)}/classification`,
        { classification }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.categories.classifications() });
    },
  });
}

export function useApplyCategoryRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/api/v2/categories/apply"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.categories.all });
      qc.invalidateQueries({ queryKey: queryKeys.transactions.all });
    },
  });
}
