/**
 * kolshek schedule — Manage automatic fetch scheduling via OS task scheduler.
 */

import type { Command } from "commander";
import { join } from "node:path";
import {
  registerSchedule,
  unregisterSchedule,
  checkScheduleRegistered,
  currentPlatform,
} from "../../core/scheduler/index.js";
import type { ScheduleConfig, ScheduleStatus } from "../../types/index.js";
import { getAppPaths } from "../../config/loader.js";
import {
  isJsonMode,
  printJson,
  jsonSuccess,
  printError,
  info,
  createSpinner,
  createTable,
  ExitCode,
} from "../output.js";
import { run } from "../../core/scheduler/index.js";

// ---------------------------------------------------------------------------
// Schedule metadata — stored in {dataDir}/schedule.json
// ---------------------------------------------------------------------------

function scheduleJsonPath(): string {
  const paths = getAppPaths();
  return join(paths.data, "schedule.json");
}

async function readScheduleConfig(): Promise<ScheduleConfig | null> {
  const file = Bun.file(scheduleJsonPath());
  if (!(await file.exists())) return null;
  try {
    return (await file.json()) as ScheduleConfig;
  } catch {
    return null;
  }
}

async function writeScheduleConfig(config: ScheduleConfig): Promise<void> {
  await Bun.write(scheduleJsonPath(), JSON.stringify(config, null, 2));
}

async function deleteScheduleConfig(): Promise<void> {
  const { unlink } = await import("node:fs/promises");
  try {
    await unlink(scheduleJsonPath());
  } catch { /* ignore if not exists */ }
}

// ---------------------------------------------------------------------------
// Binary resolution
// ---------------------------------------------------------------------------

async function resolveBinaryPath(): Promise<string> {
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
  return `bun run ${scriptPath}`;
}

// ---------------------------------------------------------------------------
// Interval parsing
// ---------------------------------------------------------------------------

function parseInterval(value: string): number | null {
  const match = value.match(/^(\d+)h$/i);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  if (hours < 1 || hours > 168) return null;
  return hours;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

export function registerScheduleCommand(program: Command): void {
  const schedule = program
    .command("schedule")
    .description("Manage automatic fetch scheduling");

  schedule
    .command("set")
    .description("Register a recurring fetch task with the OS scheduler")
    .requiredOption("--every <interval>", "Fetch interval (e.g. 6h, 12h, 24h)")
    .action(async (opts: { every: string }) => {
      const intervalHours = parseInterval(opts.every);
      if (intervalHours === null) {
        printError("BAD_INTERVAL", `Invalid interval: ${opts.every}`, {
          suggestions: [
            "Use format like 6h, 12h, 24h (range: 1h–168h)",
          ],
        });
        process.exit(ExitCode.BadArgs);
      }

      const spinner = createSpinner("Registering scheduled task...");
      spinner.start();

      let binaryPath: string;
      try {
        binaryPath = await resolveBinaryPath();
      } catch (err) {
        spinner.fail("Failed to resolve kolshek binary path");
        printError("BINARY_NOT_FOUND", err instanceof Error ? err.message : String(err), {
          suggestions: ["Ensure kolshek is installed globally or run from a compiled binary"],
        });
        process.exit(ExitCode.Error);
      }

      const config: ScheduleConfig = {
        intervalHours,
        registeredAt: new Date().toISOString(),
        platform: currentPlatform(),
        binaryPath,
      };

      try {
        await registerSchedule(config);
        await writeScheduleConfig(config);
        spinner.succeed("Scheduled task registered.");
      } catch (err) {
        spinner.fail("Failed to register scheduled task");
        printError("SCHEDULE_ERROR", err instanceof Error ? err.message : String(err), {
          retryable: true,
          suggestions: [
            "Ensure you have permission to create scheduled tasks",
            process.platform === "win32"
              ? "Try running as administrator"
              : "Check systemd/crontab access",
          ],
        });
        process.exit(ExitCode.Error);
      }

      if (isJsonMode()) {
        printJson(jsonSuccess({ action: "registered", ...config }));
        return;
      }

      info(`  Interval: every ${intervalHours}h`);
      info(`  Binary: ${binaryPath}`);
      info(`  Platform: ${currentPlatform()}`);
    });

  schedule
    .command("remove")
    .description("Unregister the recurring fetch task")
    .action(async () => {
      const spinner = createSpinner("Removing scheduled task...");
      spinner.start();

      try {
        await unregisterSchedule();
        await deleteScheduleConfig();
        spinner.succeed("Scheduled task removed.");
      } catch (err) {
        spinner.fail("Failed to remove scheduled task");
        printError("SCHEDULE_ERROR", err instanceof Error ? err.message : String(err), {
          retryable: true,
        });
        process.exit(ExitCode.Error);
      }

      if (isJsonMode()) {
        printJson(jsonSuccess({ action: "removed" }));
      }
    });

  schedule
    .command("status")
    .description("Show current schedule status")
    .action(async () => {
      const saved = await readScheduleConfig();
      const osRegistered = await checkScheduleRegistered();

      const status: ScheduleStatus = {
        registered: osRegistered,
      };

      if (saved) {
        status.intervalHours = saved.intervalHours;
        status.registeredAt = saved.registeredAt;
        status.platform = saved.platform;
        status.binaryPath = saved.binaryPath;

        // Estimate next run
        if (osRegistered) {
          const registeredDate = new Date(saved.registeredAt);
          const intervalMs = saved.intervalHours * 60 * 60 * 1000;
          const now = Date.now();
          const elapsed = now - registeredDate.getTime();
          const periods = Math.ceil(elapsed / intervalMs);
          const nextRun = new Date(registeredDate.getTime() + periods * intervalMs);
          status.nextRunAt = nextRun.toISOString();
        }
      }

      if (isJsonMode()) {
        printJson(jsonSuccess(status));
        return;
      }

      if (!status.registered && !saved) {
        info("No scheduled fetch configured.");
        info('Run "kolshek schedule set --every 6h" to set up automatic fetching.');
        return;
      }

      const rows: string[][] = [];
      rows.push(["Status", osRegistered ? "Active" : "Not registered in OS"]);
      if (saved) {
        rows.push(["Interval", `Every ${saved.intervalHours}h`]);
        rows.push(["Registered", saved.registeredAt]);
        rows.push(["Platform", saved.platform]);
        rows.push(["Binary", saved.binaryPath]);
        if (status.nextRunAt) {
          rows.push(["Next run (est.)", status.nextRunAt]);
        }
      }

      if (!osRegistered && saved) {
        rows.push(["Warning", "Task exists in config but not in OS scheduler"]);
      }

      const table = createTable(["Field", "Value"], rows);
      console.log(table);
    });
}
