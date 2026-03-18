// kolshek dashboard — starts a local settings dashboard web server.

import type { Command } from "commander";
import { startDashboard } from "../../web/server.js";
import { info, success } from "../output.js";

export function registerDashboardCommand(program: Command): void {
  program
    .command("dashboard")
    .description("Open the settings dashboard in your browser")
    .option("-p, --port <port>", "Port to listen on", "3000")
    .option("--no-open", "Don't auto-open the browser")
    .action(async (opts: { port: string; open: boolean }) => {
      const port = Number(opts.port);

      const { server, token } = startDashboard(port);
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
