// Hooks for custom pages: listing, detail fetching, query resolution, and SSE events.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

// Types matching the server response shapes
export interface CustomPageMeta {
  id: string;
  title: string;
  icon: string;
  description: string | null;
  sortOrder: number;
}

export interface CustomPageFull extends CustomPageMeta {
  definition: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// List all custom pages (sidebar)
export function useCustomPages() {
  return useQuery({
    queryKey: queryKeys.customPages.list(),
    queryFn: () => api.get<CustomPageMeta[]>("/api/v2/pages"),
  });
}

// Get a single page definition
export function useCustomPage(id: string) {
  return useQuery({
    queryKey: queryKeys.customPages.detail(id),
    queryFn: () => api.get<CustomPageFull>(`/api/v2/pages/${id}`),
    enabled: !!id,
  });
}

// Batch query resolution for widget data
export interface BatchQuery {
  key: string;
  query: Record<string, unknown>;
}

export function useWidgetQueries(
  pageId: string,
  queries: BatchQuery[],
  filters?: Record<string, unknown>,
) {
  return useQuery({
    queryKey: queryKeys.widgetQueries.batch(pageId, filters),
    queryFn: () =>
      api.post<Record<string, unknown>>("/api/v2/query/batch", {
        queries: queries.map((q) => ({
          key: q.key,
          query: filters ? mergeFiltersIntoQuery(q.query, filters) : q.query,
        })),
      }),
    enabled: queries.length > 0,
  });
}

// Merge page-level filter state into a widget's query filters
function mergeFiltersIntoQuery(
  query: Record<string, unknown>,
  pageFilters: Record<string, unknown>,
): Record<string, unknown> {
  const existing = (query.filters ?? {}) as Record<string, unknown>;
  return {
    ...query,
    filters: { ...existing, ...pageFilters },
  };
}

// SSE subscription for page change events
export function usePageEvents() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const eventSource = new EventSource("/api/v2/pages/events");

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "page_changed" || data.type === "page_deleted") {
          // Invalidate the pages list so sidebar refreshes
          queryClient.invalidateQueries({ queryKey: queryKeys.customPages.all });
          // If a specific page changed, invalidate its detail too
          if (data.id) {
            queryClient.invalidateQueries({
              queryKey: queryKeys.customPages.detail(data.id),
            });
          }
        }
      } catch {
        // ignore parse errors
      }
    };

    return () => eventSource.close();
  }, [queryClient]);
}

// Delete a custom page
export function useDeletePage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/v2/pages/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customPages.all });
    },
  });
}
