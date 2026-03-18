// Translation hooks — Hebrew-to-English description management
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type {
  UntranslatedGroup,
  TranslatedGroup,
  TranslationRule,
} from "@/types/api";

// -- Queries --

export function useUntranslated() {
  return useQuery({
    queryKey: queryKeys.translations.untranslated(),
    queryFn: () =>
      api.get<UntranslatedGroup[]>("/api/v2/translations/untranslated"),
  });
}

export function useTranslated() {
  return useQuery({
    queryKey: queryKeys.translations.translated(),
    queryFn: () =>
      api.get<TranslatedGroup[]>("/api/v2/translations/translated"),
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
