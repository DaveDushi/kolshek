// kolshek uninstall — Remove kolshek from this machine.

import { existsSync, unlinkSync, readFileSync, writeFileSync, readdirSync, rmdirSync } from "fs";
import { join } from "path";
import type { Command } from "commander";
import {
  isJsonMode,
  printJson,
  jsonSuccess,
  printError,
  info,
  success,
  warn,
} from "../output.js";
import { getAppPaths } from "../../config/loader.js";

// Default install locations (must match install scripts)
function getDefaultInstallDir(): string {
  if (process.platform === "win32") {
    return join(process.env.LOCALAPPDATA || join(process.env.USERPROFILE || "C:\\Users\\default", "AppData", "Local"), "kolshek");
  }
  return join(process.env.HOME || "/tmp", ".local", "bin");
}

function getBinaryName(): string {
  return process.platform === "win32" ? "kolshek.exe" : "kolshek";
}

// Remove kolshek from user PATH on Windows via registry
function removeFromWindowsPath(installDir: string): boolean {
  const result = Bun.spawnSync(["reg", "query", "HKCU\\Environment", "/v", "Path"]);
  const output = result.stdout.toString();
  if (result.exitCode !== 0) return false;

  // Parse the current PATH value
  const match = output.match(/REG_(?:EXPAND_)?SZ\s+(.*)/);
  if (!match) return false;

  const currentPath = match[1].trim();
  const entries = currentPath.split(";").filter((e: string) => {
    return e.trim().replace(/\\$/, "").toLowerCase() !== installDir.replace(/\\$/, "").toLowerCase();
  });

  const newPath = entries.join(";");
  if (newPath === currentPath) return false;

  // Determine the registry type (preserve REG_EXPAND_SZ vs REG_SZ)
  const typeMatch = output.match(/(REG_(?:EXPAND_)?SZ)/);
  const regType = typeMatch ? typeMatch[1] : "REG_EXPAND_SZ";

  const setResult = Bun.spawnSync(["reg", "add", "HKCU\\Environment", "/v", "Path", "/t", regType, "/d", newPath, "/f"]);
  if (setResult.exitCode !== 0) return false;

  // Broadcast WM_SETTINGCHANGE so new terminals pick up the change
  Bun.spawnSync(["powershell", "-NoProfile", "-Command",
    "[Environment]::SetEnvironmentVariable('Path', [Environment]::GetEnvironmentVariable('Path', 'User'), 'User')"]);

  return true;
}

// Remove the sentinel line from shell profiles on Unix
function removeFromShellProfiles(): string[] {
  const home = process.env.HOME || "";
  const profiles = [
    join(home, ".zshrc"),
    join(home, ".bashrc"),
    join(home, ".bash_profile"),
    join(home, ".profile"),
    join(home, ".config", "fish", "config.fish"),
  ];

  const modified: string[] = [];
  for (const profile of profiles) {
    if (!existsSync(profile)) continue;
    try {
      const content = readFileSync(profile, "utf-8");
      if (!content.includes("# Added by kolshek installer")) continue;
      const filtered = content
        .split("\n")
        .filter((line: string) => !line.includes("# Added by kolshek installer"))
        .join("\n");
      writeFileSync(profile, filtered);
      modified.push(profile);
    } catch {
      // best-effort — skip files we can't read/write
    }
  }
  return modified;
}

// Remove a directory if it's empty
function removeIfEmpty(dir: string): boolean {
  try {
    if (!existsSync(dir)) return false;
    const entries = readdirSync(dir);
    if (entries.length === 0) {
      rmdirSync(dir);
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

// Remove a directory recursively
function removeRecursive(dir: string): boolean {
  if (!existsSync(dir)) return false;
  try {
    if (process.platform === "win32") {
      Bun.spawnSync(["cmd", "/c", "rmdir", "/s", "/q", dir]);
    } else {
      Bun.spawnSync(["rm", "-rf", dir]);
    }
    return !existsSync(dir);
  } catch {
    return false;
  }
}

export function registerUninstallCommand(program: Command): void {
  program
    .command("uninstall")
    .description("Remove KolShek from this machine")
    .option("--purge", "Also remove all config, data, and cache")
    .action(async (opts: { purge?: boolean }) => {
      const installDir = getDefaultInstallDir();
      const binaryPath = join(installDir, getBinaryName());
      // --- Remove binary ---
      let removedBinary = false;
      if (existsSync(binaryPath)) {
        try {
          if (process.platform === "win32") {
            // On Windows, we might be running from this binary
            // Rename to .bak — Windows can't delete a running exe
            const bakPath = binaryPath + ".bak";
            try {
              if (existsSync(bakPath)) unlinkSync(bakPath);
            } catch { /* ignore */ }

            try {
              unlinkSync(binaryPath);
            } catch {
              // If direct delete fails (binary is running), rename it
              // The .bak will be orphaned but harmless
              const { renameSync } = require("fs");
              renameSync(binaryPath, bakPath);
              info("Binary renamed to .bak (will be cleaned up).");
            }
          } else {
            unlinkSync(binaryPath);
          }
          removedBinary = true;
          success(`Removed ${binaryPath}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          printError("UNINSTALL_FAILED", `Failed to remove binary: ${msg}`, {
            suggestions: [`Manually delete ${binaryPath}`],
          });
        }
      } else {
        warn(`Binary not found at ${binaryPath}`);
      }

      // Remove install directory if empty
      removeIfEmpty(installDir);

      // --- Remove from PATH ---
      let removedFromPath = false;
      let modifiedProfiles: string[] = [];

      if (process.platform === "win32") {
        removedFromPath = removeFromWindowsPath(installDir);
        if (removedFromPath) {
          success(`Removed ${installDir} from user PATH`);
        }
      } else {
        modifiedProfiles = removeFromShellProfiles();
        removedFromPath = modifiedProfiles.length > 0;
        for (const p of modifiedProfiles) {
          success(`Removed PATH entry from ${p}`);
        }
      }

      // --- Purge data ---
      let purgedData = false;
      if (opts.purge) {
        const appPaths = getAppPaths();
        const dirs = [appPaths.config, appPaths.data, appPaths.cache];
        for (const dir of dirs) {
          if (removeRecursive(dir)) {
            success(`Removed ${dir}`);
            purgedData = true;
          }
        }
        if (!purgedData) {
          info("No data directories found to remove.");
        }
      }

      // --- Output ---
      if (isJsonMode()) {
        printJson(jsonSuccess({
          removedBinary,
          binaryPath,
          removedFromPath,
          purgedData,
          modifiedProfiles,
        }));
      } else {
        console.log("");
        if (removedBinary || removedFromPath) {
          info("KolShek has been uninstalled.");
        }
        if (!opts.purge) {
          const appPaths = getAppPaths();
          info(`To also remove your data, run: kolshek uninstall --purge`);
          info(`Or manually delete: ${appPaths.data}`);
        }
        if (removedFromPath) {
          console.log("");
          warn("Restart your terminal for PATH changes to take effect.");
        }
      }
    });
}
