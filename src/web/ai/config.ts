// AI configuration persistence.
// Provider/model stored in config.toml [ai] section.
// API keys stored in OS keychain via existing credential system.

import { join } from "node:path";
import { parse, stringify } from "smol-toml";
import envPaths from "env-paths";
import {
  storeCredentials,
  getCredentials,
  hasCredentials,
  deleteCredentials,
} from "../../security/keychain.js";
import type { AiConfig, AiProviderType } from "./types.js";
import { PROVIDER_REGISTRY } from "./types.js";

const paths = envPaths("kolshek");
const CONFIG_PATH = join(paths.config, "config.toml");

const VALID_PROVIDERS = new Set<string>(Object.keys(PROVIDER_REGISTRY));

// Load the [ai] section from config.toml
export async function loadAiConfig(): Promise<AiConfig | null> {
  const file = Bun.file(CONFIG_PATH);
  if (!(await file.exists())) return null;

  try {
    const text = await file.text();
    const toml = parse(text) as Record<string, unknown>;
    const ai = toml.ai as Record<string, unknown> | undefined;
    if (!ai) return null;

    const provider = ai.provider as string | undefined;
    if (!provider || !VALID_PROVIDERS.has(provider)) return null;

    return {
      provider: provider as AiProviderType,
      model: (ai.model as string) || "",
      baseUrl: ai.base_url as string | undefined,
    };
  } catch {
    return null;
  }
}

// Save the [ai] section to config.toml (preserves other sections)
export async function saveAiConfig(config: AiConfig): Promise<void> {
  const file = Bun.file(CONFIG_PATH);
  let toml: Record<string, unknown> = {};

  if (await file.exists()) {
    try {
      const text = await file.text();
      toml = parse(text) as Record<string, unknown>;
    } catch {
      // If parsing fails, start fresh
    }
  }

  // Update the [ai] section
  const aiSection: Record<string, unknown> = {
    provider: config.provider,
    model: config.model,
  };
  if (config.baseUrl) {
    aiSection.base_url = config.baseUrl;
  }
  toml.ai = aiSection;

  await Bun.write(CONFIG_PATH, stringify(toml));
}

// Keychain alias for AI provider API keys
function aiKeyAlias(provider: string): string {
  return `ai-${provider}`;
}

// Store an API key in the OS keychain
export async function saveAiApiKey(provider: string, apiKey: string): Promise<void> {
  await storeCredentials(aiKeyAlias(provider), { apiKey });
}

// Retrieve an API key from the OS keychain
export async function getAiApiKey(provider: string): Promise<string | null> {
  const creds = await getCredentials(aiKeyAlias(provider));
  return creds?.apiKey ?? null;
}

// Check if an API key exists for a provider
export async function hasAiApiKey(provider: string): Promise<boolean> {
  return hasCredentials(aiKeyAlias(provider));
}

// Delete an API key from the keychain
export async function deleteAiApiKey(provider: string): Promise<void> {
  await deleteCredentials(aiKeyAlias(provider));
}

// Check if Ollama is reachable and list models
export async function checkOllamaStatus(baseUrl?: string): Promise<{
  connected: boolean;
  models: string[];
}> {
  const ollamaBase = baseUrl || PROVIDER_REGISTRY.ollama.baseUrl;
  // The /v1 suffix is for OpenAI-compat — strip it for the native API
  const nativeBase = ollamaBase.replace(/\/v1\/?$/, "");

  try {
    const res = await fetch(`${nativeBase}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { connected: false, models: [] };
    const data = (await res.json()) as { models?: Array<{ name: string }> };
    const models = (data.models || []).map((m) => m.name);
    return { connected: true, models };
  } catch {
    return { connected: false, models: [] };
  }
}
