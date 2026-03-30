// Shared schedule config I/O — used by both CLI commands and web server.
// Reads/writes {dataDir}/schedule.json alongside the OS task scheduler.

import { join } from "node:path";
import { unlink } from "node:fs/promises";
import type { ScheduleConfig } from "../types/index.js";
import { getAppPaths } from "./loader.js";
import { run } from "../core/scheduler/index.js";

export function scheduleJsonPath(): string {
  const paths = getAppPaths();
  return join(paths.data, "schedule.json");
}

export async function readScheduleConfig(): Promise<ScheduleConfig | null> {
  const file = Bun.file(scheduleJsonPath());
  if (!(await file.exists())) return null;
  try {
    return (await file.json()) as ScheduleConfig;
  } catch {
    return null;
  }
}

export async function writeScheduleConfig(config: ScheduleConfig): Promise<void> {
  await Bun.write(scheduleJsonPath(), JSON.stringify(config, null, 2));
}

export async function deleteScheduleConfig(): Promise<void> {
  try {
    await unlink(scheduleJsonPath());
  } catch { /* ignore if not exists */ }
}

// Validate interval string like "6h" → number of hours (1–168), or null
export function parseInterval(value: string): number | null {
  const match = value.match(/^(\d+)h$/i);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  if (hours < 1 || hours > 168) return null;
  return hours;
}

// Resolve the kolshek binary path for OS scheduler registration
export async function resolveBinaryPath(): Promise<string> {

  // If running compiled (not .ts source), use the executable
  const scriptPath = process.argv[1];
  if (scriptPath && !scriptPath.endsWith(".ts")) {
    return process.argv[0];
  }

  // Try which/where to find installed binary
  const whichCmd = process.platform === "win32" ? "where" : "which";
  try {
    const out = await run([whichCmd, "kolshek"]);
    const firstLine = out.trim().split("\n")[0].trim();
    if (firstLine) return firstLine;
  } catch { /* not found */ }

  // Fallback: bun run <script>
  return `bun run "${scriptPath}"`;
}
