// Translation hooks — Hebrew-to-English description management
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type {
  UntranslatedGroup,
  TranslatedGroup,
  TranslationRule,
} from "@/types/api";

// -- Paginated response types --

interface PaginatedUntranslated {
  groups: UntranslatedGroup[];
  total: number;
}

interface PaginatedTranslated {
  groups: TranslatedGroup[];
  total: number;
}

// -- Queries --

export function useUntranslated(params?: { limit?: number; offset?: number }) {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  const suffix = qs.toString() ? `?${qs}` : "";

  return useQuery({
    queryKey: queryKeys.translations.untranslated(params),
    queryFn: () =>
      api.get<PaginatedUntranslated>(`/api/v2/translations/untranslated${suffix}`),
  });
}

export function useTranslated(params?: {
  limit?: number;
  offset?: number;
  search?: string;
}) {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  if (params?.search) qs.set("search", params.search);
  const suffix = qs.toString() ? `?${qs}` : "";

  return useQuery({
    queryKey: queryKeys.translations.translated(params),
    queryFn: () =>
      api.get<PaginatedTranslated>(`/api/v2/translations/translated${suffix}`),
  });
}

export function useTranslationRules() {
  return useQuery({
    queryKey: queryKeys.translations.rules(),
    queryFn: () =>
      api.get<TranslationRule[]>("/api/v2/translations/rules"),
  });
}

// -- Mutations --

export function useAddTranslationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      matchPattern: string;
      englishName: string;
    }) => api.post("/api/v2/translations/rules", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.translations.all });
    },
  });
}

export function useRemoveTranslationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api.delete(`/api/v2/translations/rules/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.translations.rules() });
    },
  });
}

export function useApplyTranslationRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/api/v2/translations/apply"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.translations.all });
      qc.invalidateQueries({ queryKey: queryKeys.transactions.all });
    },
  });
}

export function useTranslate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      hebrew: string;
      english: string;
      createRule?: boolean;
    }) => api.post("/api/v2/translations/translate", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.translations.all });
    },
  });
}
