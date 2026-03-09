/**
 * Schedule configuration and status types.
 */

export interface ScheduleConfig {
  intervalHours: number;
  registeredAt: string; // ISO timestamp
  platform: "win32" | "darwin" | "linux";
  binaryPath: string; // resolved kolshek executable path
}

export interface ScheduleStatus {
  registered: boolean;
  intervalHours?: number;
  registeredAt?: string;
  nextRunAt?: string; // estimated
  platform?: string;
  binaryPath?: string;
}
