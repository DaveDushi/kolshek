// Pure auth-status computation — no DB/CLI/security imports.
// Reusable by CLI, web server, and future MCP.

import type { AuthStatus } from "../types/provider.js";

// Minimum consecutive failures before marking a provider as "expired".
// A single transient failure (common with Israeli bank sites) stays "connected".
const EXPIRED_FAILURE_THRESHOLD = 2;

// Compute a provider's 4-state authentication status.
//
//   hasCreds                 – whether credentials exist (keychain/env/file)
//   latestSyncStatus         – status of most recent completed sync_log entry, or null
//   hasEverSucceeded         – whether ANY sync_log entry with status='success' exists
//   consecutiveFailures      – number of consecutive recent failures (default 0)
export function computeAuthStatus(
  hasCreds: boolean,
  latestSyncStatus: "success" | "error" | null,
  hasEverSucceeded: boolean,
  consecutiveFailures = 0,
): AuthStatus {
  if (!hasCreds) return "no";
  if (latestSyncStatus === null) return "pending";
  if (latestSyncStatus === "success") return "connected";
  // Only mark as expired after multiple consecutive failures
  if (hasEverSucceeded && consecutiveFailures >= EXPIRED_FAILURE_THRESHOLD) return "expired";
  // Single failure or never succeeded — keep as connected or pending
  if (hasEverSucceeded) return "connected";
  return "pending";
}
