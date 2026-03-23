/**
 * macOS launchd backend.
 * Creates a LaunchAgent plist for recurring fetch.
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir, unlink } from "node:fs/promises";
import type { ScheduleConfig } from "../../types/index.js";
import type { SchedulerBackend } from "./index.js";
import { run } from "./index.js";
import { escapeXml, validateBinaryPath } from "./escape.js";

const LABEL = "com.kolshek.fetch";
const PLIST_DIR = join(homedir(), "Library", "LaunchAgents");
const PLIST_PATH = join(PLIST_DIR, `${LABEL}.plist`);
const LOG_PATH = join(homedir(), "Library", "Logs", "kolshek-fetch.log");

function buildPlist(config: ScheduleConfig): string {
  const startInterval = config.intervalHours * 3600;
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${LABEL}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${escapeXml(config.binaryPath)}</string>
        <string>fetch</string>
        <string>--non-interactive</string>
    </array>
    <key>StartInterval</key>
    <integer>${startInterval}</integer>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${escapeXml(LOG_PATH)}</string>
    <key>StandardErrorPath</key>
    <string>${escapeXml(LOG_PATH)}</string>
</dict>
</plist>`;
}

const backend: SchedulerBackend = {
  async register(config: ScheduleConfig): Promise<void> {
    validateBinaryPath(config.binaryPath);
    // Unload existing if present
    try {
      await run(["launchctl", "unload", PLIST_PATH]);
    } catch { /* may not exist */ }

    await mkdir(PLIST_DIR, { recursive: true });
    await Bun.write(PLIST_PATH, buildPlist(config));
    await run(["launchctl", "load", PLIST_PATH]);
  },

  async unregister(): Promise<void> {
    await run(["launchctl", "unload", PLIST_PATH]);
    try { await unlink(PLIST_PATH); } catch { /* ignore */ }
  },

  async isRegistered(): Promise<boolean> {
    try {
      const file = Bun.file(PLIST_PATH);
      return await file.exists();
    } catch {
      return false;
    }
  },
};

export default backend;
