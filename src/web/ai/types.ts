// AI agent types — shared between server-side agent loop and SSE stream builder.
// These types use the OpenAI chat completions format as the internal representation.

// Chat message in OpenAI format
export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

// Tool call from assistant
export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

// Tool definition sent to the LLM
export interface ToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

// Assembled context for a single agent run — deep-copied, safe to mutate
export interface RunnerContext {
  systemPrompt: string;
  messages: ChatMessage[];
  tools: ToolDef[];
}

// SSE event types streamed to the frontend
export type AgentSSEEvent =
  | { type: "turn_start"; iteration: number }
  | { type: "llm_start"; model: string }
  | { type: "token"; content: string }
  | { type: "tool_call"; id: string; name: string; arguments: string; iteration: number }
  | { type: "tool_executing"; id: string; name: string }
  | { type: "tool_result"; id: string; name: string; result: string }
  | { type: "turn_end"; iteration: number }
  | { type: "usage"; tokensGenerated: number; tokPerSec: number; contextUsed: number; contextMax: number }
  | { type: "error"; message: string }
  | { type: "done" };

// Stored AI configuration (persisted in config.toml [ai] section)
export interface AiConfig {
  modelId: string;
}

// Skill file metadata
export interface Skill {
  name: string;
  filename: string;
  description: string;
  tier: "knowledge" | "workflow" | "mode";
  content: string;
}

// Chat request body from the frontend
export interface AgentChatRequest {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  enabledSkills?: string[];
  activeMode?: string;
}
