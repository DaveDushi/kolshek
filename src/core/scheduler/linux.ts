/**
 * Linux backend — prefers systemd user timer, falls back to crontab.
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir, unlink } from "node:fs/promises";
import type { ScheduleConfig } from "../../types/index.js";
import type { SchedulerBackend } from "./index.js";
import { run } from "./index.js";

const UNIT_NAME = "kolshek-fetch";
const SYSTEMD_DIR = join(homedir(), ".config", "systemd", "user");
const SERVICE_PATH = join(SYSTEMD_DIR, `${UNIT_NAME}.service`);
const TIMER_PATH = join(SYSTEMD_DIR, `${UNIT_NAME}.timer`);
const CRON_MARKER = "# kolshek-fetch";

function buildService(config: ScheduleConfig): string {
  return `[Unit]
Description=KolShek automatic fetch

[Service]
Type=oneshot
ExecStart=${config.binaryPath} fetch --non-interactive
`;
}

function buildTimer(config: ScheduleConfig): string {
  return `[Unit]
Description=KolShek fetch timer

[Timer]
OnBootSec=5min
OnUnitActiveSec=${config.intervalHours}h
Persistent=true

[Install]
WantedBy=timers.target
`;
}

async function hasSystemd(): Promise<boolean> {
  try {
    await run(["systemctl", "--user", "--no-pager", "status"]);
    return true;
  } catch {
    // systemctl may exit non-zero but still be available
    try {
      await run(["which", "systemctl"]);
      return true;
    } catch {
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// Systemd backend
// ---------------------------------------------------------------------------

async function systemdRegister(config: ScheduleConfig): Promise<void> {
  await mkdir(SYSTEMD_DIR, { recursive: true });
  await Bun.write(SERVICE_PATH, buildService(config));
  await Bun.write(TIMER_PATH, buildTimer(config));
  await run(["systemctl", "--user", "daemon-reload"]);
  await run(["systemctl", "--user", "enable", "--now", `${UNIT_NAME}.timer`]);
}

async function systemdUnregister(): Promise<void> {
  try {
    await run(["systemctl", "--user", "disable", "--now", `${UNIT_NAME}.timer`]);
  } catch { /* may not be enabled */ }
  try { await unlink(SERVICE_PATH); } catch { /* ignore */ }
  try { await unlink(TIMER_PATH); } catch { /* ignore */ }
  await run(["systemctl", "--user", "daemon-reload"]);
}

async function systemdIsRegistered(): Promise<boolean> {
  const file = Bun.file(TIMER_PATH);
  return await file.exists();
}

// ---------------------------------------------------------------------------
// Crontab fallback
// ---------------------------------------------------------------------------

async function getCrontab(): Promise<string> {
  try {
    return await run(["crontab", "-l"]);
  } catch {
    return "";
  }
}

async function cronRegister(config: ScheduleConfig): Promise<void> {
  const existing = await getCrontab();
  // Remove existing kolshek entry if any
  const lines = existing.split("\n").filter((l) => !l.includes(CRON_MARKER));
  const cronExpr = `0 */${config.intervalHours} * * *`;
  lines.push(`${cronExpr} ${config.binaryPath} fetch --non-interactive ${CRON_MARKER}`);
  const newCrontab = lines.filter((l) => l.trim()).join("\n") + "\n";
  await run(["crontab", "-"], newCrontab);
}

async function cronUnregister(): Promise<void> {
  const existing = await getCrontab();
  const lines = existing.split("\n").filter((l) => !l.includes(CRON_MARKER));
  const newCrontab = lines.filter((l) => l.trim()).join("\n") + "\n";
  await run(["crontab", "-"], newCrontab);
}

async function cronIsRegistered(): Promise<boolean> {
  const existing = await getCrontab();
  return existing.includes(CRON_MARKER);
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

const backend: SchedulerBackend = {
  async register(config: ScheduleConfig): Promise<void> {
    if (await hasSystemd()) {
      await systemdRegister(config);
    } else {
      await cronRegister(config);
    }
  },

  async unregister(): Promise<void> {
    if (await hasSystemd()) {
      await systemdUnregister();
    } else {
      await cronUnregister();
    }
  },

  async isRegistered(): Promise<boolean> {
    if (await hasSystemd()) {
      return systemdIsRegistered();
    }
    return cronIsRegistered();
  },
};

export default backend;
