// CSV import hooks — preview and confirm mutations
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { CsvImportPreview, CsvImportResult } from "@/types/api";

async function postFormData<T>(url: string, formData: FormData): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  const text = await res.text();
  const json = JSON.parse(text);
  if (!json.success) throw new Error(json.error?.message ?? "Import failed");
  return json.data;
}

export function useImportPreview() {
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return postFormData<CsvImportPreview>("/api/v2/import/csv", fd);
    },
  });
}

export function useImportConfirm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, skipErrors }: { file: File; skipErrors?: boolean }) => {
      const fd = new FormData();
      fd.append("file", file);
      if (skipErrors) fd.append("skipErrors", "true");
      return postFormData<CsvImportResult>("/api/v2/import/csv/confirm", fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.transactions.all });
      qc.invalidateQueries({ queryKey: queryKeys.accounts.all });
    },
  });
}
