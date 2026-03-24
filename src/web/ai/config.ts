// AI configuration persistence.
// Stores the selected model ID in config.toml [ai] section.
// No API keys or cloud providers — pure local inference.

import { join } from "node:path";
import { parse, stringify } from "smol-toml";
import envPaths from "env-paths";
import type { AiConfig } from "./types.js";

const paths = envPaths("kolshek");
const CONFIG_PATH = join(paths.config, "config.toml");

// Load the [ai] section from config.toml
export async function loadAiConfig(): Promise<AiConfig | null> {
  const file = Bun.file(CONFIG_PATH);
  if (!(await file.exists())) return null;

  try {
    const text = await file.text();
    const toml = parse(text) as Record<string, unknown>;
    const ai = toml.ai as Record<string, unknown> | undefined;
    if (!ai) return null;

    const modelId = ai.model_id as string | undefined;
    if (!modelId) return null;

    return { modelId };
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

  toml.ai = { model_id: config.modelId };

  await Bun.write(CONFIG_PATH, stringify(toml));
}
