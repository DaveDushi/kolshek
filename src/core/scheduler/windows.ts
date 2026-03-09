/**
 * Windows Task Scheduler backend.
 * Uses schtasks + XML task definition.
 */

import { tmpdir } from "node:os";
import { join } from "node:path";
import { unlink } from "node:fs/promises";
import type { ScheduleConfig } from "../../types/index.js";
import type { SchedulerBackend } from "./index.js";
import { run } from "./index.js";

const TASK_NAME = "KolShek Fetch";

function buildTaskXml(config: ScheduleConfig): string {
  const interval = `PT${config.intervalHours}H`;
  // Escape XML entities in binary path
  const cmd = config.binaryPath.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>true</RunOnlyIfNetworkAvailable>
    <ExecutionTimeLimit>PT1H</ExecutionTimeLimit>
    <AllowHardTerminate>true</AllowHardTerminate>
    <Hidden>false</Hidden>
  </Settings>
  <Triggers>
    <TimeTrigger>
      <StartBoundary>${new Date().toISOString().replace(/\.\d{3}Z$/, "")}</StartBoundary>
      <Enabled>true</Enabled>
      <Repetition>
        <Interval>${interval}</Interval>
        <StopAtDurationEnd>false</StopAtDurationEnd>
      </Repetition>
    </TimeTrigger>
    <LogonTrigger>
      <Enabled>true</Enabled>
      <Delay>PT5M</Delay>
    </LogonTrigger>
  </Triggers>
  <Actions Context="Author">
    <Exec>
      <Command>${cmd}</Command>
      <Arguments>fetch --non-interactive</Arguments>
    </Exec>
  </Actions>
</Task>`;
}

const backend: SchedulerBackend = {
  async register(config: ScheduleConfig): Promise<void> {
    // Write XML to temp file
    const xmlPath = join(tmpdir(), `kolshek-task-${Date.now()}.xml`);
    await Bun.write(xmlPath, buildTaskXml(config));

    try {
      await run([
        "schtasks", "/Create",
        "/TN", TASK_NAME,
        "/XML", xmlPath,
        "/F", // force overwrite if exists
      ]);
    } finally {
      try { await unlink(xmlPath); } catch { /* ignore cleanup errors */ }
    }
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
