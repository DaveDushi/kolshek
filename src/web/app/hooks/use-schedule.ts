// Schedule hooks — CRUD for sync schedule + history
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { ScheduleData } from "@/types/api";

export function useSchedule() {
  return useQuery({
    queryKey: queryKeys.schedule.status(),
    queryFn: () => api.get<ScheduleData>("/api/v2/schedule"),
    refetchInterval: 60_000, // refresh every minute to keep nextRunAt current
  });
}

export function useEnableSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (intervalHours: number) =>
      api.post("/api/v2/schedule", { intervalHours }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.schedule.all });
    },
  });
}

export function useDisableSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete("/api/v2/schedule"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.schedule.all });
    },
  });
}
