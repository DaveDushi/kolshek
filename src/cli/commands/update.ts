// kolshek update — Self-update to the latest release.

import { basename, dirname, join } from "path";
import { existsSync, renameSync, unlinkSync, chmodSync } from "fs";
import { createHash } from "crypto";
import type { Command } from "commander";
import chalk from "chalk";
import {
  isJsonMode,
  printJson,
  jsonSuccess,
  printError,
  info,
  success,
  createSpinner,
  ExitCode,
} from "../output.js";
import pkg from "../../../package.json";

const REPO = "DaveDushi/kolshek";
const API_URL = `https://api.github.com/repos/${REPO}/releases/latest`;

interface GithubAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

interface GithubRelease {
  tag_name: string;
  assets: GithubAsset[];
  html_url: string;
}

// Map Bun's os/arch to our binary naming convention
function getBinaryName(): string | null {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === "win32" && arch === "x64") return "kolshek-windows-x64.exe";
  if (platform === "linux" && arch === "x64") return "kolshek-linux-x64";
  if (platform === "linux" && arch === "arm64") return "kolshek-linux-arm64";
  if (platform === "darwin" && arch === "x64") return "kolshek-macos-x64";
  if (platform === "darwin" && arch === "arm64") return "kolshek-macos-arm64";
  return null;
}

export async function fetchLatestRelease(signal?: AbortSignal): Promise<GithubRelease> {
  const res = await fetch(API_URL, {
    headers: { Accept: "application/vnd.github+json" },
    signal,
  });
  if (!res.ok) {
    throw new Error(`GitHub API returned ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<GithubRelease>;
}

export function parseVersion(tag: string): string {
  return tag.replace(/^v/, "");
}

export function isNewer(latest: string, current: string): boolean {
  const l = latest.split(".").map(Number);
  const c = current.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((l[i] ?? 0) > (c[i] ?? 0)) return true;
    if ((l[i] ?? 0) < (c[i] ?? 0)) return false;
  }
  return false;
}

export function registerUpdateCommand(program: Command): void {
  program
    .command("update")
    .description("Update KolShek to the latest release")
    .option("--check", "Only check for updates without installing")
    .action(async (opts: { check?: boolean }) => {
      const currentVersion = pkg.version;
      const binaryName = getBinaryName();

      if (!binaryName) {
        printError("UNSUPPORTED_PLATFORM", `Unsupported platform: ${process.platform}-${process.arch}`, {
          suggestions: ["Download manually from https://github.com/DaveDushi/kolshek/releases"],
        });
        process.exit(ExitCode.Error);
      }

      const spinner = createSpinner("Checking for updates...");
      spinner.start();

      let release: GithubRelease;
      try {
        release = await fetchLatestRelease();
      } catch (err) {
        spinner.stop();
        const msg = err instanceof Error ? err.message : String(err);
        printError("UPDATE_CHECK_FAILED", `Failed to check for updates: ${msg}`, {
          retryable: true,
          suggestions: ["Check your internet connection", "Try again later"],
        });
        process.exit(ExitCode.Error);
        return; // unreachable, satisfies TS
      }

      const latestVersion = parseVersion(release.tag_name);

      if (!isNewer(latestVersion, currentVersion)) {
        spinner.succeed(`Already on the latest version (v${currentVersion}).`);
        if (isJsonMode()) {
          printJson(jsonSuccess({
            currentVersion,
            latestVersion,
            upToDate: true,
          }));
        }
        return;
      }

      if (opts.check) {
        spinner.stop();
        if (isJsonMode()) {
          printJson(jsonSuccess({
            currentVersion,
            latestVersion,
            upToDate: false,
            downloadUrl: release.html_url,
          }));
        } else {
          info(`Update available: v${currentVersion} → v${latestVersion}`);
          info(`Run ${chalk.bold("kolshek update")} to install.`);
        }
        return;
      }

      // Find the matching asset
      const asset = release.assets.find((a) => a.name === binaryName);
      if (!asset) {
        spinner.stop();
        printError("ASSET_NOT_FOUND", `No binary found for ${binaryName} in release ${release.tag_name}`, {
          suggestions: [`Download manually from ${release.html_url}`],
        });
        process.exit(ExitCode.Error);
        return;
      }

      // Download the new binary
      const sizeMB = (asset.size / 1024 / 1024).toFixed(1);
      spinner.text = `Downloading v${latestVersion} (${sizeMB} MB)...`;

      // Enforce HTTPS for binary download
      if (!asset.browser_download_url.startsWith("https://")) {
        spinner.stop();
        printError("INSECURE_DOWNLOAD", "Refusing to download binary over insecure connection.", {
          suggestions: [`Download manually from ${release.html_url}`],
        });
        process.exit(ExitCode.Error);
        return;
      }

      let buffer: ArrayBuffer;
      try {
        const res = await fetch(asset.browser_download_url);
        if (!res.ok) {
          throw new Error(`Download failed: ${res.status} ${res.statusText}`);
        }
        buffer = await res.arrayBuffer();
      } catch (err) {
        spinner.stop();
        const msg = err instanceof Error ? err.message : String(err);
        printError("DOWNLOAD_FAILED", `Failed to download update: ${msg}`, {
          retryable: true,
          suggestions: ["Check your internet connection", `Download manually from ${release.html_url}`],
        });
        process.exit(ExitCode.Error);
        return;
      }

      // Verify checksum if available (SHA256 sidecar file: binary.sha256)
      const checksumAsset = release.assets.find((a) => a.name === binaryName + ".sha256");
      if (checksumAsset) {
        spinner.text = "Verifying checksum...";
        try {
          const csRes = await fetch(checksumAsset.browser_download_url);
          if (!csRes.ok) {
            throw new Error(`Checksum file returned ${csRes.status}`);
          }
          const csText = (await csRes.text()).trim().split(/\s+/)[0].toLowerCase();
          const actual = createHash("sha256").update(Buffer.from(buffer)).digest("hex");
          if (actual !== csText) {
            spinner.stop();
            printError("CHECKSUM_MISMATCH", "Downloaded binary does not match expected SHA256 checksum. The file may be corrupted or tampered with.", {
              suggestions: [`Download manually from ${release.html_url}`, "Try again later"],
            });
            process.exit(ExitCode.Error);
            return;
          }
        } catch (err) {
          spinner.stop();
          const msg = err instanceof Error ? err.message : String(err);
          printError("CHECKSUM_FAILED", `Checksum verification failed: ${msg}. Aborting update for safety.`, {
            retryable: true,
            suggestions: ["Check your internet connection", `Download manually from ${release.html_url}`],
          });
          process.exit(ExitCode.Error);
          return;
        }
      } else {
        info("Note: No checksum file in this release. Skipping integrity verification.");
      }

      // Replace the current binary
      spinner.text = "Installing update...";
      const execPath = process.execPath;
      const execDir = dirname(execPath);
      const backupPath = join(execDir, basename(execPath) + ".bak");

      try {
        // On Windows, can't overwrite a running exe — rename it first
        if (existsSync(backupPath)) {
          unlinkSync(backupPath);
        }
        renameSync(execPath, backupPath);

        // Write new binary
        await Bun.write(execPath, buffer);

        // Set executable permission on Unix
        if (process.platform !== "win32") {
          chmodSync(execPath, 0o755);
        }

        // Clean up backup
        try {
          unlinkSync(backupPath);
        } catch {
          // On Windows the .bak may be locked; it'll be cleaned up next run
        }
      } catch (err) {
        // Attempt to restore from backup
        if (existsSync(backupPath) && !existsSync(execPath)) {
          try {
            renameSync(backupPath, execPath);
          } catch {
            // nothing more we can do
          }
        }
        spinner.stop();
        const msg = err instanceof Error ? err.message : String(err);
        printError("INSTALL_FAILED", `Failed to install update: ${msg}`, {
          suggestions: [`Download manually from ${release.html_url}`],
        });
        process.exit(ExitCode.Error);
        return;
      }

      spinner.stop();

      if (isJsonMode()) {
        printJson(jsonSuccess({
          currentVersion,
          latestVersion,
          updated: true,
        }));
      } else {
        success(`Updated KolShek: v${currentVersion} → v${latestVersion}`);
      }
    });
}
