// Sync hook — streams SSE events from the fetch endpoint.
// Supports queuing: if a sync is in progress and start() is called again,
// the new providers are queued and run automatically after the current sync.
import { useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { SyncEvent } from "@/types/api";

// Maximum queued syncs to prevent unbounded growth
const MAX_QUEUE_DEPTH = 10;

interface SyncOptions {
  visible?: boolean;
  providers?: number[];
  // Display names for the queued providers (used in sync panel)
  providerNames?: string[];
}

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
  const queueRef = useRef<SyncOptions[]>([]);
  const runningRef = useRef(false);
  const queryClient = useQueryClient();

  // Internal: run a single sync batch (no queuing logic)
  const runSync = useCallback(async (options?: SyncOptions) => {
    const controller = new AbortController();
    abortRef.current = controller;

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
        buffer = parts.pop() || "";

        for (const part of parts) {
          for (const line of part.split("\n")) {
            const event = parseSseEvent(line);
            if (event) {
              // Filter out "done" events from intermediate batches —
              // we emit our own final "done" after all queued syncs complete
              if (event.type === "done" && queueRef.current.length > 0) continue;
              setEvents((prev) => [...prev, event]);
            }
          }
        }
      }

      if (buffer.trim()) {
        for (const line of buffer.split("\n")) {
          const event = parseSseEvent(line);
          if (event) {
            if (event.type === "done" && queueRef.current.length > 0) continue;
            setEvents((prev) => [...prev, event]);
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      const message =
        err instanceof Error ? err.message : "Unknown sync error";
      setEvents((prev) => [...prev, { type: "error", error: message }]);
    } finally {
      abortRef.current = null;
    }
  }, []);

  // Process the queue: run syncs one by one until the queue is empty
  const processQueue = useCallback(async (initial: SyncOptions | undefined) => {
    if (runningRef.current) return;
    runningRef.current = true;
    setIsRunning(true);

    // Run the initial sync
    await runSync(initial);

    // Drain the queue
    while (queueRef.current.length > 0) {
      const next = queueRef.current.shift()!;
      // Remove the "queued" events for providers that are about to start
      // (they'll get real "start"/"progress" events from the server)
      await runSync(next);
    }

    runningRef.current = false;
    setIsRunning(false);
    queryClient.invalidateQueries();
  }, [runSync, queryClient]);

  const start = useCallback((options?: SyncOptions) => {
    // Normalize empty provider array to undefined (= sync all)
    if (options?.providers?.length === 0) options.providers = undefined;

    if (runningRef.current) {
      // Reject if queue is full
      if (queueRef.current.length >= MAX_QUEUE_DEPTH) return;
      // Dedup: skip if an identical provider set is already queued
      const key = options?.providers?.slice().sort().join(",") ?? "all";
      const isDuplicate = queueRef.current.some((q) => {
        const qKey = q.providers?.slice().sort().join(",") ?? "all";
        return qKey === key;
      });
      if (isDuplicate) return;
      // Already syncing — queue this request and show queued status
      queueRef.current.push(options ?? {});
      // Add synthetic "queued" events so the panel shows them
      const names = options?.providerNames ?? options?.providers?.map(String);
      setEvents((prev) => [
        ...prev,
        {
          type: "queued",
          providers: names,
          message: names ? undefined : "All providers queued",
        },
      ]);
      return;
    }

    // Fresh sync — clear previous events
    setEvents([]);
    processQueue(options);
  }, [processQueue]);

  const cancel = useCallback(async () => {
    // Abort client-side SSE stream
    abortRef.current?.abort();
    // Clear the queue so no more syncs run after cancellation
    queueRef.current = [];
    // Tell server to abort the in-progress sync
    try {
      await fetch("/api/v2/fetch/cancel", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore — sync may already be done
    }
    setEvents((prev) => [
      ...prev,
      { type: "error", error: "Sync cancelled" },
    ]);
    runningRef.current = false;
    setIsRunning(false);
    queryClient.invalidateQueries();
  }, [queryClient]);

  return { events, isRunning, start, cancel };
}
