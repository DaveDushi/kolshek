// SSE stream builder — wraps the agent loop into a ReadableStream Response.
// Follows the same pattern as startFetchSSE in server.ts.

import type { ChatMessage, AiProviderConfig, AgentSSEEvent } from "./types.js";
import { runAgentLoop } from "./agent.js";

// Create an SSE Response that streams agent events to the frontend.
export function createAgentStream(
  config: AiProviderConfig,
  messages: ChatMessage[],
  cors: Record<string, string>,
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function pushEvent(event: AgentSSEEvent) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Controller may be closed if client disconnected
        }
      }

      try {
        await runAgentLoop(config, messages, pushEvent);
        pushEvent({ type: "done" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        pushEvent({ type: "error", message: msg });
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Content-Type-Options": "nosniff",
      ...cors,
    },
  });
}
