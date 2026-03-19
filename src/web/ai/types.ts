// AI agent types — shared between server-side agent loop and SSE stream builder.
// These types use the OpenAI chat completions format as the internal representation.

// Supported providers (all OpenAI-compatible for now)
export type AiProviderType = "ollama" | "groq" | "openrouter" | "openai";

// Provider configuration for a single request
export interface AiProviderConfig {
  type: AiProviderType;
  baseUrl: string;
  model: string;
  apiKey?: string;
}

// Provider registry entry
export interface ProviderEntry {
  baseUrl: string;
  requiresKey: boolean;
  label: string;
}

// Hardcoded provider defaults
export const PROVIDER_REGISTRY: Record<AiProviderType, ProviderEntry> = {
  ollama: { baseUrl: "http://localhost:11434/v1", requiresKey: false, label: "Ollama" },
  groq: { baseUrl: "https://api.groq.com/openai/v1", requiresKey: true, label: "Groq" },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1", requiresKey: true, label: "OpenRouter" },
  openai: { baseUrl: "https://api.openai.com/v1", requiresKey: true, label: "OpenAI" },
};

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

// SSE event types streamed to the frontend
export type AgentSSEEvent =
  | { type: "token"; content: string }
  | { type: "tool_call"; id: string; name: string; arguments: string }
  | { type: "tool_result"; id: string; name: string; result: string }
  | { type: "error"; message: string }
  | { type: "done" };

// Stored AI configuration (persisted in config.toml [ai] section)
export interface AiConfig {
  provider: AiProviderType;
  model: string;
  baseUrl?: string;
}

// Skill file metadata
export interface Skill {
  name: string;
  filename: string;
  content: string;
}

// Chat request body from the frontend
export interface AgentChatRequest {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  config?: {
    provider?: AiProviderType;
    model?: string;
    baseUrl?: string;
    apiKey?: string;
  };
  enabledSkills?: string[];
}
