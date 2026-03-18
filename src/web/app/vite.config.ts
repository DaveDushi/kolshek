import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import fs from "node:fs";

// Read session cookie from .dev-session (written by the dashboard server).
// This lets the Vite proxy authenticate API requests without the browser
// needing to exchange a token first.
function readDevSession(): string | null {
  try {
    const content = fs.readFileSync(
      path.resolve(__dirname, "../../../.dev-session"),
      "utf-8",
    ).trim();
    return content || null;
  } catch {
    return null;
  }
}

export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "../dist/app"),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            // Inject the session cookie so API requests are authenticated
            const session = readDevSession();
            if (session) {
              const existing = proxyReq.getHeader("cookie") as string | undefined;
              proxyReq.setHeader("cookie", existing ? `${existing}; ${session}` : session);
            }
          });
        },
      },
    },
  },
});
