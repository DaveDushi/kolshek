// OpenAI-compatible chat completions adapter.
// Covers Ollama, Groq, OpenRouter, and OpenAI — all speak the same protocol.
// Pure fetch, no SDK dependencies.

import type { ChatMessage, ToolDef, ToolCall, AiProviderConfig } from "./types.js";

// Global counter for unique tool call IDs across agent loop iterations.
// LLMs sometimes return index-only IDs (e.g. "call_0") which collide
// when the agent loops multiple times. This counter ensures uniqueness.
let toolCallIdCounter = 0;

// A chunk parsed from the SSE stream
export interface StreamChunk {
  type: "text" | "tool_call_start" | "tool_call_delta" | "done";
  content?: string;
  toolCallIndex?: number;
  toolCallId?: string;
  toolName?: string;
  argumentsDelta?: string;
}

// Streaming callback
export type OnChunk = (chunk: StreamChunk) => void;

// Call the LLM with streaming, collecting chunks and building the full assistant message.
// Returns the complete assistant ChatMessage for appending to history.
export async function streamChat(
  config: AiProviderConfig,
  messages: ChatMessage[],
  tools: ToolDef[],
  onChunk: OnChunk,
  signal?: AbortSignal,
): Promise<ChatMessage> {
  const url = `${config.baseUrl}/chat/completions`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    stream: true,
  };
  if (tools.length > 0) {
    body.tools = tools;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM API error (${res.status}): ${text.slice(0, 500)}`);
  }

  if (!res.body) {
    throw new Error("LLM API returned no body");
  }

  // Parse the SSE stream
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  // Accumulate the full assistant message
  let contentParts: string[] = [];
  let toolCalls: Map<number, { id: string; name: string; args: string }> = new Map();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // SSE events separated by double newlines
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";

    for (const part of parts) {
      for (const line of part.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") {
          onChunk({ type: "done" });
          continue;
        }

        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(data);
        } catch {
          continue;
        }

        const choices = parsed.choices as Array<Record<string, unknown>> | undefined;
        if (!choices || choices.length === 0) continue;

        const delta = choices[0].delta as Record<string, unknown> | undefined;
        if (!delta) continue;

        // Text content
        if (delta.content) {
          const text = delta.content as string;
          contentParts.push(text);
          onChunk({ type: "text", content: text });
        }

        // Tool calls
        const deltaToolCalls = delta.tool_calls as Array<Record<string, unknown>> | undefined;
        if (deltaToolCalls) {
          for (const tc of deltaToolCalls) {
            const idx = tc.index as number;
            const fn = tc.function as Record<string, unknown> | undefined;

            if (!toolCalls.has(idx)) {
              // New tool call
              const id = (tc.id as string) || `call_${++toolCallIdCounter}`;
              const name = fn?.name as string || "";
              toolCalls.set(idx, { id, name, args: "" });
              onChunk({
                type: "tool_call_start",
                toolCallIndex: idx,
                toolCallId: id,
                toolName: name,
              });
            }

            // Accumulate arguments
            if (fn?.arguments) {
              const argDelta = fn.arguments as string;
              const existing = toolCalls.get(idx)!;
              existing.args += argDelta;
              // Also update name if it wasn't set initially
              if (fn.name && !existing.name) {
                existing.name = fn.name as string;
              }
              onChunk({
                type: "tool_call_delta",
                toolCallIndex: idx,
                argumentsDelta: argDelta,
              });
            }
          }
        }
      }
    }
  }

  // Process any remaining buffer
  if (buffer.trim()) {
    for (const line of buffer.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data);
        const choices = parsed.choices as Array<Record<string, unknown>> | undefined;
        if (choices && choices.length > 0) {
          const delta = choices[0].delta as Record<string, unknown> | undefined;
          if (delta?.content) {
            contentParts.push(delta.content as string);
          }
        }
      } catch {
        // ignore
      }
    }
  }

  // Build the final assistant message
  const assistantMessage: ChatMessage = {
    role: "assistant",
    content: contentParts.length > 0 ? contentParts.join("") : null,
  };

  if (toolCalls.size > 0) {
    const calls: ToolCall[] = [];
    // Sort by index to preserve order
    const sortedEntries = [...toolCalls.entries()].sort((a, b) => a[0] - b[0]);
    for (const [, tc] of sortedEntries) {
      calls.push({
        id: tc.id,
        type: "function",
        function: { name: tc.name, arguments: tc.args },
      });
    }
    assistantMessage.tool_calls = calls;
  }

  return assistantMessage;
}
