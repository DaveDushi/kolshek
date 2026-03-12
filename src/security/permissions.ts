// Cross-platform file permission hardening.
// Unix: chmod 0o600/0o700. Windows: icacls owner-only ACL.

import { chmodSync, statSync } from "fs";
import { spawnSync } from "child_process";

// Restrict a file or directory so only the current user can access it.
export function restrictPathToOwner(targetPath: string): void {
  if (process.platform === "win32") {
    restrictWindows(targetPath);
  } else {
    const stat = statSync(targetPath);
    const mode = stat.isDirectory() ? 0o700 : 0o600;
    chmodSync(targetPath, mode);
  }
}

function restrictWindows(targetPath: string): void {
  // icacls: remove inherited permissions, grant only current user full control
  const username = process.env.USERNAME;
  if (!username) return;

  const result = spawnSync("icacls", [
    targetPath,
    "/inheritance:r",
    "/grant:r",
    `${username}:(F)`,
  ], { stdio: "pipe", timeout: 5000 });

  // Best-effort: if icacls fails (e.g. not on PATH), silently continue.
  // The data is still protected by Windows user-session isolation.
  if (result.status !== 0 && process.env.DEBUG) {
    const stderr = result.stderr?.toString().trim();
    if (stderr) console.error(`[permissions] icacls warning: ${stderr}`);
  }
}
