// Agent loop — orchestrates local LLM inference with tool execution.
// Delegates to the local inference engine which manages the full
// multi-turn tool calling loop via node-llama-cpp.

import type { ChatMessage, AgentSSEEvent, RunnerContext, Skill, ToolDef } from "./types.js";
import { runLocalInference } from "./local/engine.js";
import { buildSystemPrompt } from "./skills.js";

export type EventCallback = (event: AgentSSEEvent) => void;

// Build an isolated runner context from frontend request data.
// Deep-copies messages so the agent loop can mutate safely.
export function buildRunnerContext(
  frontendMessages: Array<{ role: "user" | "assistant"; content: string }>,
  skills: Skill[],
  tools: ToolDef[],
  enabledSkillNames?: string[],
  activeMode?: string,
  modeContent?: string,
): RunnerContext {
  const systemPrompt = buildSystemPrompt(skills, enabledSkillNames, activeMode, modeContent);
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...structuredClone(frontendMessages),
  ];
  return { systemPrompt, messages, tools };
}

// Run the agent loop. Delegates to the local inference engine which handles
// multi-turn tool calling internally via node-llama-cpp.
// Calls `onEvent` for each SSE event to stream to the frontend.
export async function runAgentLoop(
  ctx: RunnerContext,
  onEvent: EventCallback,
  signal?: AbortSignal,
): Promise<void> {
  await runLocalInference(ctx.messages, ctx.tools, onEvent, signal);
}
