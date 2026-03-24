// Singleton inference engine — wraps node-llama-cpp for in-process LLM inference.
// Loads one model at a time. Provides runLocalInference() which manages the
// full agent loop: multi-turn tool calling with streaming text tokens.
//
// Uses LlamaChatSession with defineChatSessionFunction for reliable function
// calling — node-llama-cpp handles history, result matching, and looping internally.

import type { AgentSSEEvent, ChatMessage, ToolDef } from "../types.js";
import { executeToolAsync } from "../tools.js";
import { TOOL_DEFS_LOCAL, TOOL_DEFS_FULL } from "../tools.js";
import { MODEL_REGISTRY, getModelPath } from "./models.js";
import type { ModelEntry } from "./models.js";

// Inference profile — scales with model capability tier.
// Small models get fewer tools, less context, tighter limits.
// Large models get the full experience.
interface InferenceProfile {
  contextSize: number;
  maxToolIterations: number;
  maxHistoryMessages: number;
  tools: ToolDef[];
  disableThinking: boolean;
}

function getInferenceProfile(entry: ModelEntry): InferenceProfile {
  switch (entry.tier) {
    case 1: // 3-4B models — 2 tools, strict limits
      return {
        contextSize: 8192,
        maxToolIterations: 3,
        maxHistoryMessages: 8,
        tools: TOOL_DEFS_LOCAL,
        disableThinking: true,
      };
    case 2: // 8-12B models — moderate context, local tools, reasonable limits
      return {
        contextSize: 8192,
        maxToolIterations: 4,
        maxHistoryMessages: 16,
        tools: TOOL_DEFS_LOCAL,
        disableThinking: true,
      };
    case 3: // 24-32B models — large context, full tools, generous limits
      return {
        contextSize: 16384,
        maxToolIterations: 8,
        maxHistoryMessages: 24,
        tools: TOOL_DEFS_FULL,
        disableThinking: false,
      };
    case 4: // 70B+ models — maximum capability
      return {
        contextSize: 32768,
        maxToolIterations: 10,
        maxHistoryMessages: 32,
        tools: TOOL_DEFS_FULL,
        disableThinking: false,
      };
    default:
      return {
        contextSize: 4096,
        maxToolIterations: 3,
        maxHistoryMessages: 8,
        tools: TOOL_DEFS_LOCAL,
        disableThinking: true,
      };
  }
}

// Active profile — set when model is loaded, used during inference
let activeProfile: InferenceProfile | null = null;

// Module-level singleton state — one model loaded at a time
let llamaInstance: any = null;
let modelInstance: any = null;
let contextInstance: any = null;
let sequenceInstance: any = null;
let loadedModelId: string | null = null;

// --- Model lifecycle ---

// Load a GGUF model into memory. Unloads any previously loaded model first.
export async function loadModel(
  modelId: string,
  onProgress?: (percent: number) => void,
): Promise<void> {
  if (modelInstance) await unloadModel();

  const entry = MODEL_REGISTRY.find((m) => m.id === modelId);
  if (!entry) throw new Error(`Unknown model: ${modelId}`);

  const modelPath = getModelPath(modelId);
  const file = Bun.file(modelPath);
  if (!(await file.exists())) {
    throw new Error(`Model file not found: ${modelPath}. Download it first.`);
  }

  const { getLlama } = await import("node-llama-cpp");
  // Try Vulkan first (Intel Arc, AMD), then CUDA (NVIDIA), then CPU fallback.
  // Auto-detect may miss Intel Arc — explicit Vulkan is needed.
  const gpuAttempts: Array<{ gpu: any; label: string }> = [
    { gpu: "vulkan", label: "Vulkan" },
    { gpu: "auto", label: "auto" },
    { gpu: false, label: "CPU-only" },
  ];
  for (const attempt of gpuAttempts) {
    try {
      llamaInstance = await getLlama({ gpu: attempt.gpu });
      console.log(`[engine] Backend: ${attempt.label} (gpu=${llamaInstance.gpu})`);
      break;
    } catch (err) {
      console.warn(`[engine] ${attempt.label} init failed:`, err);
      if (attempt.gpu === false) throw err; // CPU is last resort
    }
  }

  modelInstance = await llamaInstance.loadModel({
    modelPath,
    gpuLayers: "auto",
    onLoadProgress: onProgress
      ? (percent: number) => onProgress(Math.round(percent * 100))
      : undefined,
  });
  // Set inference profile based on model tier — scales context, tools, limits
  activeProfile = getInferenceProfile(entry);
  console.log(`[engine] Model loaded: ${modelId}, tier ${entry.tier}, ctx ${activeProfile.contextSize}, tools ${activeProfile.tools.length}, thinking ${!activeProfile.disableThinking}`);

  const ctxSize = Math.min(entry.contextWindow, activeProfile.contextSize);
  contextInstance = await modelInstance.createContext({ contextSize: ctxSize });
  sequenceInstance = contextInstance.getSequence();

  loadedModelId = modelId;
}

// Unload the current model and free all resources.
export async function unloadModel(): Promise<void> {
  if (sequenceInstance) {
    try { sequenceInstance.dispose(); } catch { /* already disposed */ }
    sequenceInstance = null;
  }
  if (contextInstance) {
    try { await contextInstance.dispose(); } catch { /* already disposed */ }
    contextInstance = null;
  }
  if (modelInstance) {
    try { modelInstance.dispose(); } catch { /* already disposed */ }
    modelInstance = null;
  }
  llamaInstance = null;
  loadedModelId = null;
}

export function isModelLoaded(): boolean {
  return modelInstance !== null && loadedModelId !== null;
}

export function getLoadedModelId(): string | null {
  return loadedModelId;
}

export function getLoadedModelInfo(): {
  id: string;
  name: string;
  contextSize: number;
  gpuBackend: string;
  tier: number;
} | null {
  if (!loadedModelId) return null;
  const entry = MODEL_REGISTRY.find((m) => m.id === loadedModelId);
  if (!entry) return null;
  return {
    id: entry.id,
    name: entry.name,
    contextSize: contextInstance?.contextSize ?? 0,
    gpuBackend: llamaInstance?.gpu ? String(llamaInstance.gpu) : "cpu",
    tier: entry.tier,
  };
}

// Get the active tools for the currently loaded model's tier
export function getActiveTools(): ToolDef[] {
  return activeProfile?.tools ?? TOOL_DEFS_LOCAL;
}

// --- Inference ---

export type EventCallback = (event: AgentSSEEvent) => void;

// Run a complete local inference pass with tool calling.
// Uses LlamaChatSession with defineChatSessionFunction — node-llama-cpp
// handles the function call loop, result matching, and history internally.
export async function runLocalInference(
  messages: ChatMessage[],
  tools: ToolDef[],
  onEvent: EventCallback,
  signal?: AbortSignal,
): Promise<void> {
  if (!modelInstance || !contextInstance || !sequenceInstance || !activeProfile) {
    throw new Error("No model loaded — download and load a model first");
  }

  const profile = activeProfile;
  const { LlamaChatSession, defineChatSessionFunction } = await import("node-llama-cpp");

  // Extract system prompt
  const systemPrompt = messages[0]?.role === "system" ? (messages[0].content || "") : "";

  // Find the last user message
  let lastUserText = "";
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      lastUserText = messages[i].content || "";
      break;
    }
  }

  if (!lastUserText) {
    onEvent({ type: "error", message: "No user message to process" });
    return;
  }

  // Build conversation context from recent history.
  // Include prior exchanges as text so the model has context without
  // manual history management (which breaks tool result passing).
  const historyStart = messages[0]?.role === "system" ? 1 : 0;
  let lastUserIdx = messages.length - 1;
  while (lastUserIdx > historyStart && messages[lastUserIdx].role !== "user") {
    lastUserIdx--;
  }
  const priorMsgs = messages.slice(
    Math.max(historyStart, lastUserIdx - profile.maxHistoryMessages),
    lastUserIdx,
  );

  let contextLines: string[] = [];
  for (const msg of priorMsgs) {
    if (msg.role === "user" && msg.content) {
      contextLines.push(`User: ${msg.content}`);
    } else if (msg.role === "assistant" && msg.content) {
      contextLines.push(`Assistant: ${msg.content}`);
    }
    // Skip tool messages — results are embedded in assistant messages
  }

  const fullPrompt = contextLines.length > 0
    ? `${contextLines.join("\n")}\n\nUser: ${lastUserText}`
    : lastUserText;

  // Create a fresh session per request.
  // LlamaChatSession manages the function calling loop and history internally.
  const hasThinking = !systemPrompt.startsWith("/no_think");
  console.log(`[engine] Prompt: ${fullPrompt.length} chars, thinking=${hasThinking}`);
  const session = new LlamaChatSession({
    contextSequence: sequenceInstance,
    systemPrompt: systemPrompt || undefined,
  });

  // Build function handlers using defineChatSessionFunction.
  // node-llama-cpp calls these automatically when the model emits function calls,
  // feeds the return value back as the tool result, and continues generation.
  let toolCallCounter = 0;
  let lastToolCallKey = "";
  let duplicateCount = 0;

  const functions: Record<string, any> = {};
  for (const tool of tools) {
    const toolName = tool.function.name;
    functions[toolName] = defineChatSessionFunction({
      description: tool.function.description,
      params: tool.function.parameters,
      async handler(params: Record<string, unknown>) {
        const callId = `local_${++toolCallCounter}`;

        // Duplicate detection — small models loop on the same call
        const callKey = `${toolName}:${JSON.stringify(params)}`;
        if (callKey === lastToolCallKey) {
          duplicateCount++;
          console.warn(`[engine] Duplicate tool call #${duplicateCount}: ${toolName}`);
          if (duplicateCount >= 2) {
            return "STOP. Answer the user now using the data you already received.";
          }
          return "Already called with same arguments. Use the previous result to answer.";
        }
        lastToolCallKey = callKey;
        duplicateCount = 0;

        // Emit events so the frontend shows the tool call
        onEvent({
          type: "tool_call",
          id: callId,
          name: toolName,
          arguments: JSON.stringify(params),
          iteration: 0,
        });
        onEvent({ type: "tool_executing", id: callId, name: toolName });

        let result: string;
        try {
          result = await executeToolAsync(toolName, params);
        } catch (err) {
          result = JSON.stringify({
            error: err instanceof Error ? err.message : String(err),
          });
        }

        onEvent({ type: "tool_result", id: callId, name: toolName, result });

        // Truncate large results to avoid context overflow.
        // Frontend gets the full result via the event above; the model gets a trimmed version.
        const maxChars = profile.contextSize <= 8192 ? 1500 : 4000;
        let trimmed = result;
        if (trimmed.length > maxChars) {
          trimmed = trimmed.slice(0, maxChars) + "...(truncated)";
          console.log(`[engine] Tool result truncated: ${result.length} → ${maxChars} chars`);
        }

        // Return parsed result — node-llama-cpp stringifies it for the model
        try { return JSON.parse(trimmed); } catch { return trimmed; }
      },
    });
  }

  // Emit events
  onEvent({ type: "turn_start", iteration: 0 });
  onEvent({ type: "llm_start", model: loadedModelId || "local" });

  const genStart = Date.now();
  let tokenCount = 0;

  try {
    const response = await session.prompt(fullPrompt, {
      functions: Object.keys(functions).length > 0 ? functions : undefined,
      maxTokens: profile.contextSize,
      stopOnAbortSignal: true,
      signal,
      onTextChunk(text: string) {
        if (text) {
          tokenCount++;
          onEvent({ type: "token", content: text });
        }
      },
    });

    const elapsed = (Date.now() - genStart) / 1000;
    const tokSec = elapsed > 0 ? (tokenCount / elapsed).toFixed(1) : "?";
    console.log(`[engine] Generated ${tokenCount} tokens in ${elapsed.toFixed(1)}s (${tokSec} tok/s)`);

    onEvent({ type: "turn_end", iteration: 0 });
  } catch (err) {
    if (
      err instanceof Error &&
      (err.name === "AbortError" || err.message.includes("abort"))
    ) {
      onEvent({ type: "error", message: "Request cancelled" });
      return;
    }
    console.error("[engine] Inference error:", err);
    onEvent({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
