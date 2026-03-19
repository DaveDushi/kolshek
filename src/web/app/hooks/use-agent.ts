// Agent hook — manages conversation state and SSE streaming for the AI chat.
// Mirrors the use-sync.ts pattern: POST to endpoint, parse SSE stream, update state.

import { useState, useCallback, useRef } from "react";

// Agent message displayed in the chat UI
export interface AgentMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: AgentToolCall[];
  isStreaming?: boolean;
}

export interface AgentToolCall {
  id: string;
  name: string;
  arguments: string;
  result?: string;
}

// SSE event from the server
interface AgentSSEEvent {
  type: "token" | "tool_call" | "tool_result" | "error" | "done";
  content?: string;
  id?: string;
  name?: string;
  arguments?: string;
  result?: string;
  message?: string;
}

// Config override for a single request
export interface AgentRequestConfig {
  provider?: string;
  model?: string;
  baseUrl?: string;
  apiKey?: string;
}

function parseSseEvent(line: string): AgentSSEEvent | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return null;
  const json = trimmed.slice(5).trim();
  if (!json) return null;
  try {
    return JSON.parse(json) as AgentSSEEvent;
  } catch {
    return null;
  }
}

let messageCounter = 0;
function nextId(): string {
  return `msg-${++messageCounter}-${Date.now()}`;
}

export function useAgent() {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (text: string, config?: AgentRequestConfig, enabledSkills?: string[]) => {
      if (!text.trim()) return;

      // Abort any in-flight request
      if (abortRef.current) {
        abortRef.current.abort();
      }

      const controller = new AbortController();
      abortRef.current = controller;

      setError(null);

      // Add user message to state
      const userMsg: AgentMessage = {
        id: nextId(),
        role: "user",
        content: text.trim(),
      };

      // Prepare assistant message placeholder
      const assistantId = nextId();
      const assistantMsg: AgentMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        toolCalls: [],
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      try {
        // Build the full message history for context
        // (current messages + new user message, excluding the placeholder assistant)
        const history = [
          ...messages.map((m) => ({ role: m.role, content: m.content })),
          { role: "user" as const, content: text.trim() },
        ];

        const body: Record<string, unknown> = { messages: history };
        if (config) body.config = config;
        if (enabledSkills) body.enabledSkills = enabledSkills;

        const res = await fetch("/api/v2/agent/chat", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          let errMsg = `Server error (${res.status})`;
          try {
            const errBody = await res.json();
            if (errBody?.error?.message) errMsg = errBody.error.message;
          } catch {
            // use default
          }
          setError(errMsg);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: errMsg, isStreaming: false } : m
            )
          );
          setIsStreaming(false);
          return;
        }

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
              const event = parseSseEvent(line);
              if (!event) continue;

              switch (event.type) {
                case "token":
                  if (event.content) {
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantId
                          ? { ...m, content: m.content + event.content }
                          : m
                      )
                    );
                  }
                  break;

                case "tool_call":
                  if (event.id && event.name) {
                    const tc: AgentToolCall = {
                      id: event.id,
                      name: event.name,
                      arguments: event.arguments || "{}",
                    };
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantId
                          ? { ...m, toolCalls: [...(m.toolCalls || []), tc] }
                          : m
                      )
                    );
                  }
                  break;

                case "tool_result":
                  if (event.id) {
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantId
                          ? {
                              ...m,
                              toolCalls: (m.toolCalls || []).map((tc) =>
                                tc.id === event.id
                                  ? { ...tc, result: event.result }
                                  : tc
                              ),
                            }
                          : m
                      )
                    );
                  }
                  break;

                case "error":
                  setError(event.message || "Unknown error");
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? {
                            ...m,
                            content: m.content || event.message || "An error occurred.",
                            isStreaming: false,
                          }
                        : m
                    )
                  );
                  break;

                case "done":
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId ? { ...m, isStreaming: false } : m
                    )
                  );
                  break;
              }
            }
          }
        }

        // Process remaining buffer
        if (buffer.trim()) {
          for (const line of buffer.split("\n")) {
            const event = parseSseEvent(line);
            if (event?.type === "token" && event.content) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + event.content }
                    : m
                )
              );
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const msg = err instanceof Error ? err.message : "Unknown error";
        setError(msg);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: m.content || msg, isStreaming: false }
              : m
          )
        );
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
        // Mark streaming done in case it wasn't already
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId && m.isStreaming ? { ...m, isStreaming: false } : m
          )
        );
      }
    },
    [messages]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
  }, []);

  return { messages, isStreaming, error, send, stop, clear };
}
