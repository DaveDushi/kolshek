/**
 * OS task scheduler — registers/unregisters recurring kolshek fetch tasks.
 *
 * Dispatches to platform-specific backends (Windows Task Scheduler,
 * macOS launchd, Linux systemd/cron).
 */

import type { ScheduleConfig } from "../../types/index.js";

/** Run a subprocess and return stdout. Throws on non-zero exit. */
export async function run(
  cmd: string[],
  stdin?: string,
): Promise<string> {
  const proc = Bun.spawn(cmd, {
    stdout: "pipe",
    stderr: "pipe",
    stdin: stdin !== undefined ? "pipe" : undefined,
  });

  if (stdin !== undefined && proc.stdin) {
    proc.stdin.write(stdin);
    proc.stdin.end();
  }

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0) {
    throw new Error(`Command failed (exit ${exitCode}): ${stderr.trim() || stdout.trim()}`);
  }
  return stdout;
}

export interface SchedulerBackend {
  register(config: ScheduleConfig): Promise<void>;
  unregister(): Promise<void>;
  isRegistered(): Promise<boolean>;
}

type Platform = "win32" | "darwin" | "linux";

function getPlatform(): Platform {
  const p = process.platform;
  if (p === "win32" || p === "darwin" || p === "linux") return p;
  throw new Error(`Unsupported platform for scheduling: ${p}`);
}

async function getBackend(): Promise<SchedulerBackend> {
  const platform = getPlatform();
  switch (platform) {
    case "win32": {
      const mod = await import("./windows.js");
      return mod.default;
    }
    case "darwin": {
      const mod = await import("./macos.js");
      return mod.default;
    }
    case "linux": {
      const mod = await import("./linux.js");
      return mod.default;
    }
  }
}

export async function registerSchedule(config: ScheduleConfig): Promise<void> {
  const backend = await getBackend();
  await backend.register(config);
}

export async function unregisterSchedule(): Promise<void> {
  const backend = await getBackend();
  await backend.unregister();
}

export async function checkScheduleRegistered(): Promise<boolean> {
  const backend = await getBackend();
  return backend.isRegistered();
}

export function currentPlatform(): Platform {
  return getPlatform();
}
