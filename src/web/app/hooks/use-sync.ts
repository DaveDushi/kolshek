// Sync hook — streams SSE events from the fetch endpoint
import { useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { SyncEvent } from "@/types/api";

// Parse a single SSE "data: {...}" line into a SyncEvent
function parseSseEvent(line: string): SyncEvent | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return null;
  const json = trimmed.slice(5).trim();
  if (!json) return null;
  try {
    return JSON.parse(json) as SyncEvent;
  } catch {
    return null;
  }
}

export function useSync() {
  const [events, setEvents] = useState<SyncEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();

  const start = useCallback(async (options?: { visible?: boolean; providers?: number[] }) => {
    // Prevent double-start
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setEvents([]);
    setIsRunning(true);

    try {
      const body: Record<string, unknown> = {};
      if (options?.visible) body.visible = true;
      if (options?.providers?.length) body.providers = options.providers;
      const hasBody = Object.keys(body).length > 0;
      const res = await fetch("/api/v2/fetch", {
        method: "POST",
        credentials: "include",
        headers: hasBody ? { "Content-Type": "application/json" } : {},
        body: hasBody ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const text = await res.text();
        setEvents((prev) => [
          ...prev,
          { type: "error", error: text || "Fetch failed" },
        ]);
        setIsRunning(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE events are separated by double newlines
        const parts = buffer.split("\n\n");
        // Keep the last incomplete chunk in the buffer
        buffer = parts.pop() || "";

        for (const part of parts) {
          // Each part may have multiple lines (event:, data:, etc.)
          for (const line of part.split("\n")) {
            const event = parseSseEvent(line);
            if (event) {
              setEvents((prev) => [...prev, event]);
            }
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        for (const line of buffer.split("\n")) {
          const event = parseSseEvent(line);
          if (event) {
            setEvents((prev) => [...prev, event]);
          }
        }
      }
    } catch (err: unknown) {
      // Ignore abort errors
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      const message =
        err instanceof Error ? err.message : "Unknown sync error";
      setEvents((prev) => [...prev, { type: "error", error: message }]);
    } finally {
      setIsRunning(false);
      abortRef.current = null;
      // Invalidate all cached queries so the dashboard shows fresh data
      queryClient.invalidateQueries();
    }
  }, [queryClient]);

  return { events, isRunning, start };
}
