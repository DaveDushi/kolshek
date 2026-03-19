// Agent loop — orchestrates LLM calls and tool execution.
// Runs iteratively: LLM responds → tool calls detected → tools executed →
// results fed back → LLM called again. Repeats until the LLM produces
// a final text response or max iterations reached.

import type { ChatMessage, AiProviderConfig, AgentSSEEvent } from "./types.js";
import { TOOL_DEFS, executeTool } from "./tools.js";
import { streamChat } from "./providers.js";

const MAX_ITERATIONS = 10;

export type EventCallback = (event: AgentSSEEvent) => void;

// Run the agent loop. Modifies `messages` in place (appends assistant + tool messages).
// Calls `onEvent` for each SSE event to stream to the frontend.
export async function runAgentLoop(
  config: AiProviderConfig,
  messages: ChatMessage[],
  onEvent: EventCallback,
  signal?: AbortSignal,
): Promise<void> {
  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    // Check abort
    if (signal?.aborted) {
      onEvent({ type: "error", message: "Request cancelled" });
      return;
    }

    // Call the LLM with streaming
    const assistantMessage = await streamChat(
      config,
      messages,
      TOOL_DEFS,
      (chunk) => {
        // Forward text tokens to frontend
        if (chunk.type === "text" && chunk.content) {
          onEvent({ type: "token", content: chunk.content });
        }
      },
      signal,
    );

    // Add assistant message to history
    messages.push(assistantMessage);

    // Check if assistant wants to call tools
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      for (const toolCall of assistantMessage.tool_calls) {
        // Parse arguments
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(toolCall.function.arguments || "{}");
        } catch {
          // If parsing fails, pass empty args
        }

        // Emit tool_call event so frontend can show the tool call
        onEvent({
          type: "tool_call",
          id: toolCall.id,
          name: toolCall.function.name,
          arguments: toolCall.function.arguments,
        });

        // Execute the tool
        const result = executeTool(toolCall.function.name, args);

        // Emit tool_result event
        onEvent({
          type: "tool_result",
          id: toolCall.id,
          name: toolCall.function.name,
          result,
        });

        // Add tool result to message history
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        });
      }

      // Continue the loop — call LLM again with tool results
      continue;
    }

    // No tool calls — the assistant produced a final text response.
    // Text tokens were already streamed via onEvent in the streamChat callback.
    return;
  }

  // Hit max iterations
  onEvent({ type: "error", message: "Agent reached maximum tool call iterations (10). Stopping." });
}
