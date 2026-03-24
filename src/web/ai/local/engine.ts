// Singleton inference engine — wraps node-llama-cpp for in-process LLM inference.
// Loads one model at a time. Provides runLocalInference() which manages the
// full agent loop: multi-turn tool calling with streaming text tokens.
//
// Uses LlamaChat (not LlamaChatSession) for manual control over:
//   - Chat history (converted from OpenAI format)
//   - Tool execution (our handlers, not auto-executed)
//   - Iteration limits and abort signals
//   - SSE event emission at each step

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
    case 1: // 3-4B models — minimal context, 2 tools, strict limits
      return {
        contextSize: 4096,
        maxToolIterations: 3,
        maxHistoryMessages: 8,
        tools: TOOL_DEFS_LOCAL,
        disableThinking: true,
      };
    case 2: // 8-12B models — moderate context, full tools, reasonable limits
      return {
        contextSize: 8192,
        maxToolIterations: 6,
        maxHistoryMessages: 16,
        tools: TOOL_DEFS_FULL,
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

// --- History conversion ---

// Convert our OpenAI-format ChatMessage[] into node-llama-cpp's ChatHistoryItem[]
// format for LlamaChat. Groups assistant + tool messages into model responses
// with function call results.
//
// node-llama-cpp history format:
//   { type: "system", text }
//   { type: "user", text }
//   { type: "model", response: [string | { type: "functionCall", name, params, result }] }
function convertToLlamaChatHistory(
  messages: ChatMessage[],
  chatWrapper: any,
): { chatHistory: any[]; lastUserText: string } {
  let systemPrompt = "";
  let idx = 0;

  if (messages[0]?.role === "system") {
    systemPrompt = messages[0].content || "";
    idx = 1;
  }

  // Generate initial history with system prompt via the chat wrapper
  // (this ensures the system prompt is formatted correctly for the model's template)
  const chatHistory: any[] = chatWrapper.generateInitialChatHistory({
    systemPrompt: systemPrompt || undefined,
  });

  // Find the last user message — that becomes the prompt, not history
  let lastUserIdx = -1;
  for (let j = messages.length - 1; j >= idx; j--) {
    if (messages[j].role === "user") {
      lastUserIdx = j;
      break;
    }
  }

  // Process messages between system prompt and the last user message
  let i = idx;
  while (i < lastUserIdx) {
    const msg = messages[i];

    if (msg.role === "user") {
      chatHistory.push({ type: "user", text: msg.content || "" });
      i++;

      // Collect all non-user messages into model responses + tool results
      while (i < lastUserIdx && messages[i].role !== "user") {
        const cur = messages[i];

        if (cur.role === "assistant") {
          const response: any[] = [];
          if (cur.content) response.push(cur.content);

          if (cur.tool_calls?.length) {
            // Build function calls with their results from subsequent tool messages
            for (const tc of cur.tool_calls) {
              let params: Record<string, unknown> = {};
              try { params = JSON.parse(tc.function.arguments || "{}"); } catch { /* empty */ }

              // Find matching tool result in following messages
              let result = "";
              for (let j = i + 1; j < messages.length; j++) {
                if (messages[j].role === "tool" && messages[j].tool_call_id === tc.id) {
                  result = messages[j].content || "";
                  break;
                }
              }

              response.push({
                type: "functionCall",
                name: tc.function.name,
                params,
                result,
              });
            }
          }

          if (response.length > 0) {
            chatHistory.push({ type: "model", response });
          }
        }
        // Skip tool messages — already consumed via tool_call_id matching above
        i++;
      }
    } else {
      // Skip orphan non-user messages at the start (shouldn't happen normally)
      i++;
    }
  }

  const lastUserText = lastUserIdx >= 0 ? (messages[lastUserIdx].content || "") : "";

  return { chatHistory, lastUserText };
}

// --- Inference ---

export type EventCallback = (event: AgentSSEEvent) => void;

// Run a complete local inference pass with multi-turn tool calling.
// Replaces both streamChat() from providers.ts and the iteration loop from agent.ts.
//
// Uses LlamaChat for manual loop control:
//   1. Convert messages to LlamaChat history format
//   2. Call generateResponse with onTextChunk for streaming
//   3. If function calls: execute tools, add results, loop back to 2
//   4. If no function calls: done
export async function runLocalInference(
  messages: ChatMessage[],
  tools: ToolDef[],
  onEvent: EventCallback,
  signal?: AbortSignal,
): Promise<void> {
  if (!modelInstance || !contextInstance || !activeProfile) {
    throw new Error("No model loaded — download and load a model first");
  }

  const profile = activeProfile;

  // Trim history based on model tier. Always keep system prompt + last N messages.
  if (messages.length > profile.maxHistoryMessages + 1) {
    const system = messages[0]?.role === "system" ? [messages[0]] : [];
    const recent = messages.slice(-(profile.maxHistoryMessages));
    messages = [...system, ...recent];
  }

  const { LlamaChat } = await import("node-llama-cpp");

  // Create LlamaChat instance for this request, reusing the persistent sequence
  const llamaChat = new LlamaChat({
    contextSequence: sequenceInstance,
  });

  // Convert OpenAI-format messages to node-llama-cpp history
  const { chatHistory, lastUserText } = convertToLlamaChatHistory(
    messages,
    llamaChat.chatWrapper,
  );

  if (!lastUserText) {
    onEvent({ type: "error", message: "No user message to process" });
    return;
  }

  // Build function definitions — no handlers, we execute manually
  const functionDefinitions: Record<string, { description: string; params: any }> = {};
  for (const tool of tools) {
    functionDefinitions[tool.function.name] = {
      description: tool.function.description,
      params: tool.function.parameters,
    };
  }
  const hasFunctions = Object.keys(functionDefinitions).length > 0;

  // Add the new user message + empty model response slot
  chatHistory.push({ type: "user", text: lastUserText });
  chatHistory.push({ type: "model", response: [] });

  let iteration = 0;
  let toolCallCounter = 0;

  // Track previous tool calls to detect loops (same tool + same args = loop)
  let lastToolCallKey = "";

  // Context window tracking for efficient KV cache reuse across iterations
  let lastContextShiftMetadata: any;
  let chatHistoryContextWindow: any[] | undefined;

  // Emit initial turn events
  onEvent({ type: "turn_start", iteration: 0 });
  onEvent({ type: "llm_start", model: loadedModelId || "local" });

  try {
    while (iteration < profile.maxToolIterations) {
      if (signal?.aborted) {
        onEvent({ type: "error", message: "Request cancelled" });
        return;
      }

      // On the last allowed iteration, remove tools so the model MUST generate
      // text instead of looping with more tool calls.
      const isLastIteration = iteration >= profile.maxToolIterations - 1;
      const offerFunctions = hasFunctions && !isLastIteration;

      // Generate one response from the model
      const genStart = Date.now();
      let tokenCount = 0;
      const res = await llamaChat.generateResponse(chatHistory, {
        functions: offerFunctions ? functionDefinitions : undefined,
        // Disable thinking for small models (wastes tokens), allow for large ones
        ...(profile.disableThinking ? { budgets: { thoughtTokens: 0 } } : {}),
        onTextChunk: (text: string) => {
          if (text) {
            tokenCount++;
            onEvent({ type: "token", content: text });
          }
        },
        signal,
        ...(lastContextShiftMetadata != null
          ? { contextShift: { lastEvaluationMetadata: lastContextShiftMetadata } }
          : {}),
        ...(chatHistoryContextWindow != null
          ? { lastEvaluationContextWindow: { history: chatHistoryContextWindow } }
          : {}),
      });

      const elapsed = (Date.now() - genStart) / 1000;
      const tokSec = elapsed > 0 ? (tokenCount / elapsed).toFixed(1) : "?";
      console.log(`[engine] Generated ${tokenCount} tokens in ${elapsed.toFixed(1)}s (${tokSec} tok/s)`);

      // Update history state from the evaluation
      chatHistory.length = 0;
      chatHistory.push(...res.lastEvaluation.cleanHistory);
      chatHistoryContextWindow = res.lastEvaluation.contextWindow;
      lastContextShiftMetadata = res.lastEvaluation.contextShiftMetadata;

      // No function calls → model produced a final text response, we're done
      if (!res.functionCalls || res.functionCalls.length === 0) {
        onEvent({ type: "turn_end", iteration });
        return;
      }

      // Detect duplicate tool calls — if same tool+args as last iteration, force text
      const currentCallKey = res.functionCalls
        .map((fc: any) => `${fc.functionName}:${JSON.stringify(fc.params)}`)
        .join("|");
      if (currentCallKey === lastToolCallKey) {
        console.warn("[engine] Duplicate tool call detected, forcing text response");
        // Re-run without functions to force text output
        chatHistory.push({ type: "model", response: [] });
        const forceRes = await llamaChat.generateResponse(chatHistory, {
          ...(profile.disableThinking ? { budgets: { thoughtTokens: 0 } } : {}),
          onTextChunk: (text: string) => {
            if (text) onEvent({ type: "token", content: text });
          },
          signal,
        });
        onEvent({ type: "turn_end", iteration });
        return;
      }
      lastToolCallKey = currentCallKey;

      // Execute each function call
      const toolCallItems: any[] = [];
      const toolResults: any[] = [];

      for (const fc of res.functionCalls) {
        const callId = `local_${++toolCallCounter}`;
        const toolName = fc.functionName;
        const params = fc.params as Record<string, unknown>;

        // Emit tool_call event so frontend can show what's being called
        onEvent({
          type: "tool_call",
          id: callId,
          name: toolName,
          arguments: JSON.stringify(params),
          iteration,
        });
        onEvent({ type: "tool_executing", id: callId, name: toolName });

        // Execute the tool
        let result: string;
        try {
          result = await executeToolAsync(toolName, params);
        } catch (err) {
          result = JSON.stringify({
            error: err instanceof Error ? err.message : String(err),
          });
        }

        onEvent({ type: "tool_result", id: callId, name: toolName, result });

        // Build items for LlamaChat history
        toolCallItems.push({
          type: "functionCall",
          name: toolName,
          params,
          rawCall: fc.raw,
        });
        // Extract tool call ID from rawCall — it may be a string or object with id
        const rawId = fc.raw && typeof fc.raw === "object" && "id" in fc.raw
          ? String((fc.raw as Record<string, unknown>).id)
          : callId;
        toolResults.push({
          toolCallId: rawId,
          result,
        });
      }

      // Add tool call results to history so the model can use them
      chatHistory.push({
        type: "toolCall",
        toolCalls: toolCallItems,
        results: toolResults,
      });

      // Add empty model response slot for the next generation
      chatHistory.push({ type: "model", response: [] });

      // Transition turns
      onEvent({ type: "turn_end", iteration });
      iteration++;
      onEvent({ type: "turn_start", iteration });
      onEvent({ type: "llm_start", model: loadedModelId || "local" });
    }

    // Hit max iterations safety limit
    onEvent({
      type: "error",
      message: `Agent reached maximum tool call iterations (${profile.maxToolIterations}). Stopping.`,
    });
  } catch (err) {
    if (
      err instanceof Error &&
      (err.name === "AbortError" || err.message.includes("abort"))
    ) {
      onEvent({ type: "error", message: "Request cancelled" });
      return;
    }
    throw err;
  }
}
