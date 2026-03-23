// Windows Task Scheduler backend.
// Uses inline schtasks params (no XML) so it works without admin elevation.

import type { ScheduleConfig } from "../../types/index.js";
import type { SchedulerBackend } from "./index.js";
import { run } from "./index.js";

const TASK_NAME = "KolShek Fetch";

// Map intervalHours → schtasks /SC and /MO flags.
// Supports fractional hours (e.g. 0.5 = 30 min). Uses /SC MINUTE for sub-hour
// or non-integer-hour intervals, /SC HOURLY for 1–23h, DAILY/WEEKLY for longer.
function scheduleFlags(hours: number): string[] {
  const totalMinutes = Math.round(hours * 60);
  if (hours >= 168) return ["/SC", "WEEKLY"];
  if (hours >= 24 && Number.isInteger(hours / 24)) return ["/SC", "DAILY", "/MO", String(Math.round(hours / 24))];
  // Use MINUTE for sub-hour or fractional-hour intervals (max 1439)
  if (!Number.isInteger(hours) || hours < 1) return ["/SC", "MINUTE", "/MO", String(totalMinutes)];
  return ["/SC", "HOURLY", "/MO", String(hours)];
}

// Format current time as HH:MM for /ST flag
function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const backend: SchedulerBackend = {
  async register(config: ScheduleConfig): Promise<void> {
    const tr = `"${config.binaryPath}" fetch --non-interactive`;
    await run([
      "schtasks", "/Create",
      "/TN", TASK_NAME,
      ...scheduleFlags(config.intervalHours),
      "/TR", tr,
      "/ST", nowHHMM(),
      "/F", // overwrite if exists
    ]);
  },

  async unregister(): Promise<void> {
    await run(["schtasks", "/Delete", "/TN", TASK_NAME, "/F"]);
  },

  async isRegistered(): Promise<boolean> {
    try {
      await run(["schtasks", "/Query", "/TN", TASK_NAME]);
      return true;
    } catch {
      return false;
    }
  },
};

export default backend;
