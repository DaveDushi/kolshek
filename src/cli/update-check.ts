// Passive update-availability check with 24h file cache.
// Never blocks CLI execution. All errors silently swallowed.

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { getAppPaths } from "../config/loader.js";
import { fetchLatestRelease, parseVersion, isNewer } from "./commands/update.js";
import pkg from "../../package.json";

interface UpdateCache {
  latestVersion: string;
  checkedAt: string;
}

const STALE_MS = 24 * 60 * 60 * 1000; // 24 hours

function getCachePath(): string {
  return join(getAppPaths().cache, "update-check.json");
}

function readCache(): UpdateCache | null {
  try {
    const raw = readFileSync(getCachePath(), "utf-8");
    const parsed = JSON.parse(raw);
    if (typeof parsed.latestVersion === "string" && typeof parsed.checkedAt === "string") {
      return parsed as UpdateCache;
    }
    return null;
  } catch {
    return null;
  }
}

function isCacheStale(cache: UpdateCache | null): boolean {
  if (!cache) return true;
  const age = Date.now() - new Date(cache.checkedAt).getTime();
  return age > STALE_MS || age < 0;
}

// Fire-and-forget GitHub API check. Writes cache for next invocation.
export function refreshUpdateCacheInBackground(): void {
  fetchLatestRelease()
    .then((release) => {
      const latestVersion = parseVersion(release.tag_name);
      const cachePath = getCachePath();
      try {
        mkdirSync(dirname(cachePath), { recursive: true });
      } catch {
        // already exists
      }
      const data: UpdateCache = { latestVersion, checkedAt: new Date().toISOString() };
      writeFileSync(cachePath, JSON.stringify(data));
    })
    .catch(() => {
      // Silent — never interrupt the CLI for update checks
    });
}

// Main entry point. Sync cache read, optional background refresh.
// Returns update info if a newer version exists, null otherwise.
export function checkForUpdate(): { latest: string; current: string } | null {
  try {
    const cache = readCache();
    if (isCacheStale(cache)) {
      refreshUpdateCacheInBackground();
    }
    if (cache && isNewer(cache.latestVersion, pkg.version)) {
      return { latest: cache.latestVersion, current: pkg.version };
    }
    return null;
  } catch {
    return null;
  }
}
