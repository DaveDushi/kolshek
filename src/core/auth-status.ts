// Pure auth-status computation — no DB/CLI/security imports.
// Reusable by CLI, web server, and future MCP.

import type { AuthStatus } from "../types/provider.js";

// Compute a provider's 4-state authentication status.
//
//   hasCreds           – whether credentials exist (keychain/env/file)
//   latestSyncStatus   – status of most recent completed sync_log entry, or null
//   hasEverSucceeded   – whether ANY sync_log entry with status='success' exists
export function computeAuthStatus(
  hasCreds: boolean,
  latestSyncStatus: "success" | "error" | null,
  hasEverSucceeded: boolean,
): AuthStatus {
  if (!hasCreds) return "no";
  if (latestSyncStatus === null) return "pending";
  if (latestSyncStatus === "success") return "connected";
  if (hasEverSucceeded) return "expired";
  return "pending";
}
