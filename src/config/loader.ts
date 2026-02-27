import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import envPaths from "env-paths";
import { parse } from "smol-toml";
import type { AppConfig } from "../types/index.js";
import { DEFAULT_CONFIG } from "../types/index.js";
import { parseConfig } from "./schema.js";

const paths = envPaths("kolshek");

export function getAppPaths() {
  return {
    config: paths.config,
    data: paths.data,
    cache: paths.cache,
  };
}

export function getDbPath(): string {
  return join(paths.data, "kolshek.db");
}

export async function ensureDirectories(): Promise<void> {
  // Use mode 0o700 to restrict access to the current user (owner-only on Linux/macOS)
  const mode = process.platform !== "win32" ? 0o700 : undefined;
  await Promise.all([
    mkdir(paths.config, { recursive: true, mode }),
    mkdir(paths.data, { recursive: true, mode }),
  ]);
}

async function loadTomlConfig(): Promise<Record<string, unknown>> {
  const configPath = join(paths.config, "config.toml");
  const file = Bun.file(configPath);
  if (!(await file.exists())) {
    return {};
  }
  const text = await file.text();
  return parse(text) as Record<string, unknown>;
}

function applyEnvOverrides(config: Record<string, unknown>): Record<string, unknown> {
  const chromePath = process.env.KOLSHEK_CHROME_PATH;
  if (chromePath !== undefined) {
    config.chromePath = chromePath;
  }

  const concurrency = process.env.KOLSHEK_CONCURRENCY;
  if (concurrency !== undefined) {
    const parsed = Number(concurrency);
    if (!Number.isNaN(parsed)) {
      config.concurrency = parsed;
    }
  }

  // KOLSHEK_DATA_DIR overrides the data directory but is handled at the paths level,
  // not in AppConfig. We expose it via getAppPaths override if needed.

  return config;
}

export async function loadConfig(): Promise<AppConfig> {
  const toml = await loadTomlConfig();
  const merged = { ...DEFAULT_CONFIG, ...toml };
  const withEnv = applyEnvOverrides(merged);
  return parseConfig(withEnv);
}
