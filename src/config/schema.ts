import { z } from "zod";
import type { AppConfig } from "../types/index.js";
import { DEFAULT_CONFIG } from "../types/index.js";

export const viewportSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const appConfigSchema = z.object({
  chromePath: z.string().optional(),
  initialSyncDays: z.number().int().positive().default(DEFAULT_CONFIG.initialSyncDays),
  syncOverlapDays: z.number().int().nonnegative().default(DEFAULT_CONFIG.syncOverlapDays),
  concurrency: z.number().int().positive().default(DEFAULT_CONFIG.concurrency),
  navigationRetryCount: z.number().int().nonnegative().default(DEFAULT_CONFIG.navigationRetryCount),
  viewport: viewportSchema.default(DEFAULT_CONFIG.viewport),
  screenshotPath: z.string().optional(),
  dateFormat: z.string().default(DEFAULT_CONFIG.dateFormat),
});

export function parseConfig(raw: unknown): AppConfig {
  return appConfigSchema.parse(raw);
}
