// kolshek sync-history — View scraper audit trail and sync operation history.

import { writeFileSync } from "fs";
import type { Command } from "commander";
import chalk from "chalk";
import { listSyncLogs, type SyncLogWithProvider } from "../../db/repositories/sync-log.js";
import {
  isJsonMode,
  printJson,
  jsonSuccess,
  info,
  createTable,
  ExitCode,
} from "../output.js";
import pkg from "../../../package.json";

function formatDuration(ms: number | null): string {
  if (ms == null) return "-";
  if (ms < 1000) return "<1s";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainSec = seconds % 60;
  return remainSec > 0 ? `${minutes}m ${remainSec}s` : `${minutes}m`;
}

function formatTime(iso: string): string {
  const d = new Date(iso + (iso.endsWith("Z") ? "" : "Z"));
  return d.toLocaleString();
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function buildExportReport(entries: SyncLogWithProvider[]): object {
  const successCount = entries.filter((e) => e.status === "success").length;
  const errorCount = entries.filter((e) => e.status === "error").length;

  const durations = entries
    .map((e) => e.durationMs)
    .filter((d): d is number => d != null);
  const avgDurationMs =
    durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : null;

  // Count errors by type
  const errorBreakdown: Record<string, number> = {};
  for (const e of entries) {
    if (e.errorType) {
      errorBreakdown[e.errorType] = (errorBreakdown[e.errorType] ?? 0) + 1;
    }
  }

  return {
    exportedAt: new Date().toISOString(),
    version: pkg.version,
    entries,
    summary: {
      total: entries.length,
      success: successCount,
      error: errorCount,
      avgDurationMs,
      errorBreakdown,
    },
  };
}

export function registerSyncHistoryCommand(program: Command): void {
  program
    .command("sync-history")
    .description("Show recent sync operations and their outcomes")
    .option("--limit <n>", "Number of entries to show", "20")
    .option("--provider <alias>", "Filter by provider alias or companyId")
    .option("--status <status>", "Filter by status (success|error)")
    .option("--export <path>", "Export sync history as JSON report")
    .action(async (opts: { limit: string; provider?: string; status?: string; export?: string }) => {
      const limit = parseInt(opts.limit, 10) || 20;
      const status = opts.status as "success" | "error" | undefined;

      if (opts.status && opts.status !== "success" && opts.status !== "error") {
        console.error(`Invalid status filter: ${opts.status}. Use "success" or "error".`);
        process.exit(ExitCode.BadArgs);
      }

      const entries = listSyncLogs({
        limit,
        providerAlias: opts.provider,
        status,
      });

      // Export mode
      if (opts.export) {
        const report = buildExportReport(entries);
        writeFileSync(opts.export, JSON.stringify(report, null, 2), "utf-8");
        if (isJsonMode()) {
          printJson(jsonSuccess({ path: opts.export, entries: entries.length }));
        } else {
          info(`Exported ${entries.length} sync log entries to ${opts.export}`);
        }
        return;
      }

      // JSON mode
      if (isJsonMode()) {
        printJson(jsonSuccess(entries));
        return;
      }

      // Human table
      if (entries.length === 0) {
        info("No sync history found.");
        return;
      }

      const rows = entries.map((e) => {
        const statusStr =
          e.status === "success"
            ? chalk.green("✓")
            : chalk.red("✗");
        const trigger = chalk.dim(e.triggerType ?? "manual");
        const duration = formatDuration(e.durationMs);
        const added = e.transactionsAdded > 0 ? chalk.green(`+${e.transactionsAdded}`) : "0";
        const updated = e.transactionsUpdated > 0 ? chalk.yellow(`~${e.transactionsUpdated}`) : "0";
        const errorType = e.errorType ? chalk.red(e.errorType) : "";
        const errorMsg = e.errorMessage ? chalk.dim(truncate(e.errorMessage, 40)) : "";

        return [
          e.providerAlias || e.providerDisplayName,
          statusStr,
          trigger,
          formatTime(e.startedAt),
          duration,
          added,
          updated,
          errorType,
          errorMsg,
        ];
      });

      const table = createTable(
        ["Provider", "", "Trigger", "Started", "Duration", "Added", "Updated", "Error Type", "Error"],
        rows,
      );
      console.log(table);
    });
}
