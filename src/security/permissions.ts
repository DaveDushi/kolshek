// Cross-platform file permission hardening.
// Unix: chmod 0o600/0o700. Windows: icacls owner-only ACL.

import { chmodSync, statSync } from "fs";

// Restrict a file or directory so only the current user can access it.
// Skips virtual paths like SQLite's :memory: that don't exist on disk.
export function restrictPathToOwner(targetPath: string): void {
  if (targetPath === ":memory:") return;
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
  const username = process.env.USERNAME
    || process.env.USERPROFILE?.split("\\").pop();
  if (!username) {
    console.error(
      `[security] WARNING: Cannot determine username for file permissions on ${targetPath}. ` +
      "Credentials may be accessible to other users.",
    );
    return;
  }

  // Use Bun.spawnSync — Node's child_process.spawnSync doesn't reliably
  // capture icacls exit status or stderr under Bun on Windows.
  const result = Bun.spawnSync([
    "icacls",
    targetPath,
    "/inheritance:r",
    "/grant:r",
    `${username}:(F)`,
  ], { stderr: "pipe" });

  if (result.exitCode !== 0) {
    const stderr = result.stderr ? new TextDecoder().decode(result.stderr).trim() : "";
    console.error(`[security] WARNING: Failed to restrict permissions on ${targetPath}: ${stderr || "unknown error"}`);
  }
}
