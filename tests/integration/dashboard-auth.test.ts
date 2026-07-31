// End-to-end checks on dashboard authentication and origin handling. This
// hardening shipped in v0.3.8 and was silently dropped by a merge; nothing
// covered it, so nobody noticed. Skipped under vitest/node (needs Bun.serve).

import { describe, it, expect, afterEach } from "vitest";
import { startDashboard } from "../../src/web/server.js";

const hasBunServe = typeof globalThis.Bun !== "undefined" && typeof globalThis.Bun?.serve === "function";

type Started = ReturnType<typeof startDashboard>;
let running: Started | null = null;

function start(): { base: string; token: string } {
  running = startDashboard(0);
  return { base: `http://127.0.0.1:${running.server.port}`, token: running.token };
}

afterEach(() => {
  running?.server.stop(true);
  running = null;
});

describe.skipIf(!hasBunServe)("dashboard authentication", () => {
  it("rejects unauthenticated API requests", async () => {
    const { base } = start();
    const res = await fetch(`${base}/api/v2/providers`);
    expect(res.status).toBe(401);
  });

  it("rejects an invalid URL token", async () => {
    const { base } = start();
    const res = await fetch(`${base}/?token=wrong`, { redirect: "manual" });
    expect(res.status).toBe(401);
  });

  it("exchanges a valid URL token for a session cookie", async () => {
    const { base, token } = start();
    const res = await fetch(`${base}/?token=${token}`, { redirect: "manual" });
    expect(res.status).toBe(302);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("kolshek_session=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Secure");
  });

  it("consumes the URL token — a second use is rejected", async () => {
    const { base, token } = start();
    const first = await fetch(`${base}/?token=${token}`, { redirect: "manual" });
    expect(first.status).toBe(302);
    const replay = await fetch(`${base}/?token=${token}`, { redirect: "manual" });
    expect(replay.status).toBe(401);
  });

  it("does not accept the URL token as a standing credential on the API", async () => {
    const { base, token } = start();
    const res = await fetch(`${base}/api/v2/providers?token=${token}`);
    expect(res.status).not.toBe(200);
  });
});

describe.skipIf(!hasBunServe)("dashboard origin and host enforcement", () => {
  it("blocks reads and mutations from the Vite dev origin outside dev mode", async () => {
    const { base, token } = start();
    const cookie = `kolshek_session=${token}`;

    const read = await fetch(`${base}/api/v2/providers`, {
      headers: { Cookie: cookie, Origin: "http://localhost:5173" },
    });
    expect(read.status).toBe(403);

    const write = await fetch(`${base}/api/v2/providers`, {
      method: "POST",
      headers: { Cookie: cookie, Origin: "http://localhost:5173", "Content-Type": "application/json" },
      body: "{}",
    });
    expect(write.status).toBe(403);
  });

  it("blocks mutations carrying no Origin header", async () => {
    const { base, token } = start();
    const res = await fetch(`${base}/api/v2/providers`, {
      method: "POST",
      headers: { Cookie: `kolshek_session=${token}`, "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(403);
  });

  it("rejects a non-loopback Host header (DNS rebinding)", async () => {
    const { base, token } = start();
    const res = await fetch(`${base}/api/v2/providers`, {
      headers: { Cookie: `kolshek_session=${token}`, Host: "evil.example" },
    });
    expect(res.status).toBe(403);
  });

  it("never reflects an unknown origin in Access-Control-Allow-Origin", async () => {
    const { base } = start();
    const res = await fetch(`${base}/api/v2/providers`, {
      method: "OPTIONS",
      headers: { Origin: "http://evil.example" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    expect(res.headers.get("access-control-allow-credentials")).toBeNull();
  });
});
