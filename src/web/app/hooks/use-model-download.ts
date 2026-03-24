// Shared hook for downloading models via SSE progress stream.
// Used by both ConfigPanel and ModelSetup to avoid duplicating SSE parsing logic.
import { useState, useCallback, useRef } from "react";

interface UseModelDownloadOptions {
  onComplete?: (modelId: string) => void | Promise<void>;
  onError?: (message: string) => void;
}

export function useModelDownload(options?: UseModelDownloadOptions) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const download = useCallback(async (modelId: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setDownloadingId(modelId);
    setDownloadProgress(0);

    try {
      const res = await fetch("/api/v2/agent/models/download", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error(`Download failed: ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const part of parts) {
          for (const line of part.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            try {
              const event = JSON.parse(trimmed.slice(5).trim());
              if (event.type === "progress") {
                setDownloadProgress(event.percent || 0);
              } else if (event.type === "done") {
                setDownloadProgress(100);
              } else if (event.type === "error") {
                throw new Error(event.message || "Download failed");
              }
            } catch (e) {
              if (e instanceof Error && !e.message.includes("Download failed")) continue;
              throw e;
            }
          }
        }
      }

      await optionsRef.current?.onComplete?.(modelId);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (err instanceof Error && err.message.includes("cancelled")) return;
      const msg = err instanceof Error ? err.message : "Download failed";
      optionsRef.current?.onError?.(msg);
    } finally {
      setDownloadingId(null);
      setDownloadProgress(0);
      abortRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    fetch("/api/v2/agent/models/cancel-download", {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
  }, []);

  return { downloadingId, downloadProgress, download, cancel };
}
