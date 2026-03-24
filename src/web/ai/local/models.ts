// Model registry and download manager.
// Curated catalog of GGUF models organized by RAM tier.
// Downloads from HuggingFace with progress callbacks and resumable support.

import { join } from "node:path";
import { readdir, unlink, mkdir, stat } from "node:fs/promises";
import envPaths from "env-paths";
import type { HardwareInfo } from "./hardware.js";

const paths = envPaths("kolshek");
const MODELS_DIR = join(paths.data, "models");

export interface ModelEntry {
  id: string;
  name: string;
  url: string;
  sizeBytes: number;
  params: string;
  quant: string;
  minRamGB: number;
  contextWindow: number;
  toolCalling: "excellent" | "good" | "basic";
  description: string;
  tier: 1 | 2 | 3 | 4;
}

export interface DownloadedModel {
  id: string;
  path: string;
  sizeBytes: number;
}

export interface ModelStatus extends ModelEntry {
  downloaded: boolean;
  downloadedPath?: string;
  loaded: boolean;
  recommended: boolean;
  compatible: boolean;
  incompatibleReason?: string;
}

// Curated model catalog — organized by RAM tier.
// Only models that can reliably handle tool calling are included.
// 3B models are chat-only fallbacks — they hallucinate tool calls.
export const MODEL_REGISTRY: ModelEntry[] = [
  // Tier 1: Lightweight (6-8 GB RAM) — chat-only, limited tool calling
  {
    id: "qwen3.5-4b-q4km",
    name: "Qwen 3.5 4B",
    url: "https://huggingface.co/unsloth/Qwen3.5-4B-GGUF/resolve/main/Qwen3.5-4B-Q4_K_M.gguf",
    sizeBytes: 2_500_000_000,
    params: "4B",
    quant: "Q4_K_M",
    minRamGB: 6,
    contextWindow: 128_000,
    toolCalling: "good",
    description: "Smallest model with reliable tool calling",
    tier: 1,
  },
  {
    id: "phi4-mini-q4km",
    name: "Phi-4 Mini",
    url: "https://huggingface.co/bartowski/microsoft_Phi-4-mini-instruct-GGUF/resolve/main/microsoft_Phi-4-mini-instruct-Q4_K_M.gguf",
    sizeBytes: 2_300_000_000,
    params: "3.8B",
    quant: "Q4_K_M",
    minRamGB: 6,
    contextWindow: 128_000,
    toolCalling: "good",
    description: "Microsoft, strong at structured output",
    tier: 1,
  },

  // Tier 2: Standard (8-16 GB RAM)
  {
    id: "gemma3-4b-q4km",
    name: "Gemma 3 4B",
    url: "https://huggingface.co/bartowski/google_gemma-3-4b-it-GGUF/resolve/main/google_gemma-3-4b-it-Q4_K_M.gguf",
    sizeBytes: 2_500_000_000,
    params: "4B",
    quant: "Q4_K_M",
    minRamGB: 8,
    contextWindow: 128_000,
    toolCalling: "good",
    description: "Google, 140+ languages",
    tier: 2,
  },
  {
    id: "qwen3-8b-q4km",
    name: "Qwen 3 8B",
    url: "https://huggingface.co/Qwen/Qwen3-8B-GGUF/resolve/main/qwen3-8b-q4_k_m.gguf",
    sizeBytes: 5_000_000_000,
    params: "8B",
    quant: "Q4_K_M",
    minRamGB: 12,
    contextWindow: 32_000,
    toolCalling: "excellent",
    description: "Strong all-rounder",
    tier: 2,
  },
  {
    id: "qwen3.5-9b-q4km",
    name: "Qwen 3.5 9B",
    url: "https://huggingface.co/unsloth/Qwen3.5-9B-GGUF/resolve/main/Qwen3.5-9B-Q4_K_M.gguf",
    sizeBytes: 5_500_000_000,
    params: "9B",
    quant: "Q4_K_M",
    minRamGB: 12,
    contextWindow: 131_000,
    toolCalling: "excellent",
    description: "Best value for 16GB RAM",
    tier: 2,
  },
  {
    id: "gemma3-12b-q4km",
    name: "Gemma 3 12B",
    url: "https://huggingface.co/bartowski/google_gemma-3-12b-it-GGUF/resolve/main/google_gemma-3-12b-it-Q4_K_M.gguf",
    sizeBytes: 6_900_000_000,
    params: "12B",
    quant: "Q4_K_M",
    minRamGB: 14,
    contextWindow: 128_000,
    toolCalling: "good",
    description: "Google, strong multilingual",
    tier: 2,
  },

  // Tier 3: Performance (24-32 GB RAM)
  {
    id: "mistral-small-3.2-24b",
    name: "Mistral Small 3.2",
    url: "https://huggingface.co/bartowski/mistralai_Mistral-Small-3.2-24B-Instruct-2506-GGUF/resolve/main/mistralai_Mistral-Small-3.2-24B-Instruct-2506-Q4_K_M.gguf",
    sizeBytes: 14_300_000_000,
    params: "24B",
    quant: "Q4_K_M",
    minRamGB: 24,
    contextWindow: 128_000,
    toolCalling: "excellent",
    description: "Best for tool calling, 2x fewer bad gens",
    tier: 3,
  },
  {
    id: "gemma3-27b-q4km",
    name: "Gemma 3 27B",
    url: "https://huggingface.co/bartowski/google_gemma-3-27b-it-GGUF/resolve/main/google_gemma-3-27b-it-Q4_K_M.gguf",
    sizeBytes: 15_900_000_000,
    params: "27B",
    quant: "Q4_K_M",
    minRamGB: 28,
    contextWindow: 128_000,
    toolCalling: "good",
    description: "Google, massive multilingual",
    tier: 3,
  },
  {
    id: "qwen3-32b-q4km",
    name: "Qwen 3 32B",
    url: "https://huggingface.co/Qwen/Qwen3-32B-GGUF/resolve/main/qwen3-32b-q4_k_m.gguf",
    sizeBytes: 19_800_000_000,
    params: "32B",
    quant: "Q4_K_M",
    minRamGB: 28,
    contextWindow: 32_000,
    toolCalling: "excellent",
    description: "Best dense model at this tier",
    tier: 3,
  },

  // Tier 4: Powerhouse (48-64 GB RAM)
  {
    id: "qwen3-32b-q5km",
    name: "Qwen 3 32B HQ",
    url: "https://huggingface.co/Qwen/Qwen3-32B-GGUF/resolve/main/qwen3-32b-q5_k_m.gguf",
    sizeBytes: 24_000_000_000,
    params: "32B",
    quant: "Q5_K_M",
    minRamGB: 32,
    contextWindow: 32_000,
    toolCalling: "excellent",
    description: "Higher quality quant if RAM allows",
    tier: 4,
  },
  {
    id: "llama3.3-70b-q4km",
    name: "Llama 3.3 70B",
    url: "https://huggingface.co/bartowski/Llama-3.3-70B-Instruct-GGUF/resolve/main/Llama-3.3-70B-Instruct-Q4_K_M.gguf",
    sizeBytes: 42_500_000_000,
    params: "70B",
    quant: "Q4_K_M",
    minRamGB: 48,
    contextWindow: 131_000,
    toolCalling: "excellent",
    description: "Best overall, near-GPT-4 quality",
    tier: 4,
  },
];

// Ensure models directory exists
async function ensureModelsDir(): Promise<void> {
  await mkdir(MODELS_DIR, { recursive: true });
}

// Get model filename from its ID
function modelFilename(id: string): string {
  return `${id}.gguf`;
}

// Get the full path for a model
export function getModelPath(id: string): string {
  return join(MODELS_DIR, modelFilename(id));
}


// List all downloaded models
export async function listDownloadedModels(): Promise<DownloadedModel[]> {
  await ensureModelsDir();

  let files: string[];
  try {
    files = await readdir(MODELS_DIR);
  } catch {
    return [];
  }

  const downloaded: DownloadedModel[] = [];
  for (const file of files) {
    if (!file.endsWith(".gguf")) continue;
    const id = file.replace(".gguf", "");
    const fullPath = join(MODELS_DIR, file);
    try {
      const st = await stat(fullPath);
      downloaded.push({ id, path: fullPath, sizeBytes: st.size });
    } catch {
      // Skip unreadable files
    }
  }
  return downloaded;
}

// Get the recommended model ID for given hardware.
// Uses available RAM (not total) so we don't recommend models that would
// thrash swap when the user has other apps running.
export function getRecommendedModelId(hw: HardwareInfo): string {
  // Use available RAM as the budget — this reflects what's actually free
  // right now, accounting for OS, browser, apps, etc.
  const budget = hw.availableRamGB;
  if (budget >= 50) return "llama3.3-70b-q4km";
  if (budget >= 20) return "mistral-small-3.2-24b";
  if (budget >= 10) return "qwen3.5-9b-q4km";
  return "qwen3.5-4b-q4km";
}

// Check if hardware can run a model
export function canRunModel(hw: HardwareInfo, model: ModelEntry): { ok: boolean; reason?: string } {
  if (hw.totalRamGB < model.minRamGB) {
    return {
      ok: false,
      reason: `Needs ${model.minRamGB} GB RAM (you have ${hw.totalRamGB} GB)`,
    };
  }
  // Warn when available RAM is tight (model would use >80% of free memory)
  const modelEstGB = model.sizeBytes / (1024 ** 3) * 1.3; // ~30% overhead for KV cache
  if (hw.availableRamGB < modelEstGB + 2) {
    return {
      ok: true,
      reason: `May be tight — only ${hw.availableRamGB.toFixed(1)} GB free right now`,
    };
  }
  return { ok: true };
}

// Build full model status list for the frontend
export async function getModelStatuses(
  hw: HardwareInfo,
  loadedModelId: string | null,
): Promise<ModelStatus[]> {
  const downloaded = await listDownloadedModels();
  const downloadedIds = new Set(downloaded.map((d) => d.id));
  const recommendedId = getRecommendedModelId(hw);

  return MODEL_REGISTRY.map((model) => {
    const compat = canRunModel(hw, model);
    const dl = downloaded.find((d) => d.id === model.id);
    return {
      ...model,
      downloaded: downloadedIds.has(model.id),
      downloadedPath: dl?.path,
      loaded: model.id === loadedModelId,
      recommended: model.id === recommendedId,
      compatible: compat.ok,
      incompatibleReason: compat.reason,
    };
  });
}

// Active download tracking
let activeDownload: AbortController | null = null;

// Download a model from HuggingFace with progress callbacks
export async function downloadModel(
  id: string,
  onProgress: (percent: number, bytesDownloaded: number, bytesTotal: number) => void,
  signal?: AbortSignal,
): Promise<string> {
  const model = MODEL_REGISTRY.find((m) => m.id === id);
  if (!model) throw new Error(`Unknown model: ${id}`);

  await ensureModelsDir();

  // Cancel any in-flight download
  if (activeDownload) {
    activeDownload.abort();
  }

  const controller = new AbortController();
  activeDownload = controller;

  // Merge external signal
  if (signal) {
    signal.addEventListener("abort", () => controller.abort());
  }

  const destPath = getModelPath(id);
  const tmpPath = destPath + ".tmp";

  try {
    // Check for partial download to resume
    let startByte = 0;
    try {
      const tmpStat = await stat(tmpPath);
      startByte = tmpStat.size;
    } catch {
      // No partial download
    }

    const headers: Record<string, string> = {};
    if (startByte > 0) {
      headers["Range"] = `bytes=${startByte}-`;
    }

    const res = await fetch(model.url, {
      headers,
      signal: controller.signal,
      redirect: "follow",
    });

    if (!res.ok && res.status !== 206) {
      throw new Error(`Download failed: HTTP ${res.status}`);
    }

    const contentLength = parseInt(res.headers.get("content-length") || "0");
    const totalBytes = res.status === 206 ? startByte + contentLength : contentLength;

    if (!res.body) throw new Error("No response body");

    // Open file for writing (append if resuming)
    const file = Bun.file(tmpPath);
    const writer = (file as any).writer ? (file as any).writer() : null;

    // If Bun.file doesn't have writer, fall back to manual approach
    const reader = res.body.getReader();
    let bytesDownloaded = startByte;
    const chunks: Uint8Array[] = [];

    // Read initial partial file if resuming
    if (startByte > 0 && !writer) {
      const existing = await Bun.file(tmpPath).arrayBuffer();
      chunks.push(new Uint8Array(existing));
    }

    let lastProgressAt = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      bytesDownloaded += value.length;

      // Throttle progress callbacks to ~4 per second
      const now = Date.now();
      if (now - lastProgressAt > 250 || bytesDownloaded >= totalBytes) {
        lastProgressAt = now;
        const percent = totalBytes > 0 ? Math.round((bytesDownloaded / totalBytes) * 100) : 0;
        onProgress(percent, bytesDownloaded, totalBytes);
      }
    }

    // Write all chunks to file
    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    await Bun.write(tmpPath, combined);

    // Rename tmp to final
    const { rename } = await import("node:fs/promises");
    await rename(tmpPath, destPath);

    onProgress(100, bytesDownloaded, totalBytes);
    return destPath;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Download cancelled");
    }
    throw err;
  } finally {
    if (activeDownload === controller) {
      activeDownload = null;
    }
  }
}

// Cancel any in-flight download
export function cancelDownload(): void {
  if (activeDownload) {
    activeDownload.abort();
    activeDownload = null;
  }
}

// Delete a downloaded model
export async function deleteModel(id: string): Promise<void> {
  const modelPath = getModelPath(id);
  try {
    await unlink(modelPath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  // Also clean up any partial downloads
  try {
    await unlink(modelPath + ".tmp");
  } catch {
    // ignore
  }
}

// Format bytes for display
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / (1024 ** 2)).toFixed(1)} MB`;
  return `${(bytes / (1024 ** 3)).toFixed(1)} GB`;
}
