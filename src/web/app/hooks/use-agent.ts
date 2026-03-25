// Agent hook — manages conversation state and SSE streaming for the AI chat.
// Mirrors the use-sync.ts pattern: POST to endpoint, parse SSE stream, update state.
// Supports lifecycle events (turn_start, llm_start, tool_executing) for status display,
// and activeMode for workflow skill activation.

import { useState, useCallback, useRef, useEffect } from "react";

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

// Rich status for the UI — includes phase, elapsed time, and iteration
export interface AgentStatus {
  label: string;
  phase: "thinking" | "tool" | "idle";
  iteration: number;
  startedAt: number; // Date.now() when this phase started
  toolName?: string;
}

// Context usage stats — updated per generation pass
export interface AgentUsage {
  contextUsed: number;
  contextMax: number;
  tokPerSec: number;
  totalGenerated: number; // cumulative tokens generated in this conversation
}

// SSE event from the server (matches AgentSSEEvent on backend)
interface AgentSSEEvent {
  type: "turn_start" | "llm_start" | "token" | "tool_call" | "tool_executing" | "tool_result" | "turn_end" | "usage" | "error" | "done";
  content?: string;
  id?: string;
  name?: string;
  arguments?: string;
  result?: string;
  message?: string;
  iteration?: number;
  model?: string;
  tokensGenerated?: number;
  tokPerSec?: number;
  contextUsed?: number;
  contextMax?: number;
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
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [usage, setUsage] = useState<AgentUsage | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const iterationRef = useRef(0);
  const totalGeneratedRef = useRef(0);

  const send = useCallback(
    async (text: string, enabledSkills?: string[], activeMode?: string, thinking?: boolean, contextSize?: number) => {
      if (!text.trim()) return;

      // Abort any in-flight request
      if (abortRef.current) {
        abortRef.current.abort();
      }

      const controller = new AbortController();
      abortRef.current = controller;

      setError(null);
      iterationRef.current = 0;
      setStatus({ label: "Thinking...", phase: "thinking", iteration: 0, startedAt: Date.now() });

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
        // Build the full message history for context.
        // Filter out assistant messages with empty content — these are from aborted
        // streams where tool calls completed but the LLM's text response was cut off.
        // Sending empty assistant messages confuses the LLM into repeating tool calls
        // without ever producing text.
        const history = [
          ...messagesRef.current
            .filter((m) => !(m.role === "assistant" && !m.content))
            .map((m) => ({ role: m.role, content: m.content })),
          { role: "user" as const, content: text.trim() },
        ];

        const body: Record<string, unknown> = { messages: history };
        if (enabledSkills) body.enabledSkills = enabledSkills;
        if (activeMode) body.activeMode = activeMode;
        if (thinking) body.thinking = true;
        if (contextSize) body.contextSize = contextSize;

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
          setStatus(null);
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
                case "turn_start": {
                  const iter = event.iteration ?? iterationRef.current;
                  iterationRef.current = iter;
                  setStatus({ label: "Thinking...", phase: "thinking", iteration: iter, startedAt: Date.now() });
                  break;
                }

                case "llm_start":
                  setStatus((prev) => ({
                    label: "Thinking...",
                    phase: "thinking" as const,
                    iteration: prev?.iteration ?? iterationRef.current,
                    startedAt: prev?.startedAt ?? Date.now(),
                  }));
                  break;

                case "token":
                  if (event.content) {
                    setStatus(null);
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

                case "tool_executing":
                  if (event.name) {
                    setStatus({
                      label: `Running ${event.name}...`,
                      phase: "tool",
                      iteration: iterationRef.current,
                      startedAt: Date.now(),
                      toolName: event.name,
                    });
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

                case "turn_end":
                  // Turn ended — if more turns follow, turn_start will set status again
                  break;

                case "usage":
                  if (event.contextUsed != null && event.contextMax != null) {
                    totalGeneratedRef.current += event.tokensGenerated ?? 0;
                    setUsage({
                      contextUsed: event.contextUsed,
                      contextMax: event.contextMax,
                      tokPerSec: event.tokPerSec ?? 0,
                      totalGenerated: totalGeneratedRef.current,
                    });
                  }
                  break;

                case "error":
                  setError(event.message || "Unknown error");
                  setStatus(null);
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
                  setStatus(null);
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
        setStatus(null);
        abortRef.current = null;
        // Mark streaming done in case it wasn't already
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId && m.isStreaming ? { ...m, isStreaming: false } : m
          )
        );
      }
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps -- uses messagesRef to avoid stale closure
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setStatus(null);
    setUsage(null);
    totalGeneratedRef.current = 0;
  }, []);

  return { messages, isStreaming, error, status, usage, send, stop, clear };
}
