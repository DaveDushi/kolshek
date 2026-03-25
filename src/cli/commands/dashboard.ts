// kolshek dashboard — starts a local settings dashboard web server.

import { resolve } from "node:path";
import type { Command } from "commander";
import { startDashboard } from "../../web/server.js";
import { info, success, warn } from "../output.js";

// Auto-build the React SPA if dist/app/index.html is missing.
// Compiled binaries already have it embedded, so this only fires in dev.
async function ensureDashboardBuilt(): Promise<void> {
  const distIndex = resolve(import.meta.dir, "../../web/dist/app/index.html");
  const exists = await Bun.file(distIndex).exists();
  if (exists) return;

  info("Building dashboard frontend...");
  const viteConfig = resolve(import.meta.dir, "../../web/app/vite.config.ts");
  const proc = Bun.spawn(["bun", "--bun", "vite", "build", "--config", viteConfig], {
    stdout: "inherit",
    stderr: "inherit",
  });
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`Dashboard build failed (exit ${code}). Run 'bun run build:web' manually.`);
  }
}

export function registerDashboardCommand(program: Command): void {
  program
    .command("dashboard")
    .description("Open the settings dashboard in your browser")
    .option("-p, --port <port>", "Port to listen on", "45091")
    .option("--no-open", "Don't auto-open the browser")
    .action(async (opts: { port: string; open: boolean }) => {
      const port = Number(opts.port);

      await ensureDashboardBuilt();

      let result: ReturnType<typeof startDashboard>;
      try {
        result = startDashboard(port);
      } catch {
        // Port may be blocked by Hyper-V / WSL reserved ranges on Windows.
        // Fall back to an OS-assigned port.
        try {
          result = startDashboard(0);
          warn(`Port ${port} unavailable, using ${result.server.port} instead.`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          throw new Error(`Failed to start server: ${msg}`);
        }
      }
      const { server, token } = result;
      const baseUrl = `http://localhost:${server.port}`;
      const authUrl = `${baseUrl}/?token=${token}`;

      success(`Dashboard running at ${authUrl}`);
      info("Press Ctrl+C to stop.\n");

      if (opts.open) {
        // Open browser with auth token — platform-specific
        try {
          const platform = process.platform;
          if (platform === "win32") {
            Bun.spawn(["cmd", "/c", "start", authUrl]);
          } else if (platform === "darwin") {
            Bun.spawn(["open", authUrl]);
          } else {
            Bun.spawn(["xdg-open", authUrl]);
          }
        } catch {
          // Silently ignore if browser open fails
        }
      }

      // Keep process alive — Bun.serve() runs in the background
      // but commander will try to exit. Block with a never-resolving promise.
      await new Promise(() => {});
    });
}
