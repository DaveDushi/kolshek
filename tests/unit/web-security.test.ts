// Dashboard access-control helpers: origin allowlisting, CORS header emission,
// Host validation, and the two sanitising helpers.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getAllowedOrigins,
  corsHeaders,
  isLoopbackHost,
  isSafeRegex,
  sanitizeError,
  isDevMode,
  safeEqual,
} from "../../src/web/server.js";

const PORT = 45091;

describe("isDevMode", () => {
  const original = process.env.KOLSHEK_DEV;
  afterEach(() => {
    if (original === undefined) delete process.env.KOLSHEK_DEV;
    else process.env.KOLSHEK_DEV = original;
  });

  it("is off by default", () => {
    delete process.env.KOLSHEK_DEV;
    expect(isDevMode()).toBe(false);
  });

  it("requires the exact opt-in value — truthy strings are not enough", () => {
    for (const v of ["", "0", "true", "yes", "dev"]) {
      process.env.KOLSHEK_DEV = v;
      expect(isDevMode()).toBe(false);
    }
    process.env.KOLSHEK_DEV = "1";
    expect(isDevMode()).toBe(true);
  });
});

describe("getAllowedOrigins", () => {
  const original = process.env.KOLSHEK_DEV;
  beforeEach(() => { delete process.env.KOLSHEK_DEV; });
  afterEach(() => {
    if (original === undefined) delete process.env.KOLSHEK_DEV;
    else process.env.KOLSHEK_DEV = original;
  });

  it("trusts only the dashboard's own origin outside dev mode", () => {
    expect(getAllowedOrigins(PORT)).toEqual([
      `http://localhost:${PORT}`,
      `http://127.0.0.1:${PORT}`,
    ]);
  });

  it("does not trust the Vite dev port outside dev mode", () => {
    const origins = getAllowedOrigins(PORT);
    expect(origins).not.toContain("http://localhost:5173");
    expect(origins).not.toContain("http://127.0.0.1:5173");
  });

  it("trusts the Vite dev port only when explicitly opted in", () => {
    process.env.KOLSHEK_DEV = "1";
    const origins = getAllowedOrigins(PORT);
    expect(origins).toContain("http://localhost:5173");
    expect(origins).toContain("http://127.0.0.1:5173");
  });
});

describe("corsHeaders", () => {
  const allowed = [`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`];

  it("reflects and credentials an allowlisted origin", () => {
    const h = corsHeaders(`http://localhost:${PORT}`, allowed);
    expect(h["Access-Control-Allow-Origin"]).toBe(`http://localhost:${PORT}`);
    expect(h["Access-Control-Allow-Credentials"]).toBe("true");
  });

  it("emits no ACAO or credentials for an unknown origin", () => {
    const h = corsHeaders("http://evil.example", allowed);
    expect(h["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(h["Access-Control-Allow-Credentials"]).toBeUndefined();
  });

  it("emits no ACAO when the request has no Origin header", () => {
    const h = corsHeaders(null, allowed);
    expect(h["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(h["Access-Control-Allow-Credentials"]).toBeUndefined();
  });

  it("never credentials an origin it did not reflect", () => {
    for (const origin of [null, "http://evil.example", "http://localhost:5173"]) {
      const h = corsHeaders(origin, allowed);
      if (h["Access-Control-Allow-Credentials"] === "true") {
        expect(h["Access-Control-Allow-Origin"]).toBe(origin);
      }
    }
  });

  it("always varies on Origin so caches don't cross origins", () => {
    expect(corsHeaders(null, allowed).Vary).toBe("Origin");
  });
});

describe("safeEqual", () => {
  it("matches identical strings", () => {
    expect(safeEqual("abc123", "abc123")).toBe(true);
  });

  it("rejects differing strings, including length mismatches", () => {
    expect(safeEqual("abc123", "abc124")).toBe(false);
    expect(safeEqual("abc", "abc123")).toBe(false);
    expect(safeEqual("", "abc")).toBe(false);
  });

  it("does not throw on non-string input", () => {
    expect(safeEqual(undefined as unknown as string, "abc")).toBe(false);
    expect(safeEqual(null as unknown as string, "abc")).toBe(false);
  });

  it("compares empty strings as equal", () => {
    expect(safeEqual("", "")).toBe(true);
  });
});

describe("isLoopbackHost", () => {
  it("accepts loopback names with and without a port", () => {
    for (const h of ["localhost", "localhost:45091", "127.0.0.1", "127.0.0.1:45091", "[::1]", "[::1]:45091"]) {
      expect(isLoopbackHost(h)).toBe(true);
    }
  });

  it("is case-insensitive", () => {
    expect(isLoopbackHost("LocalHost:45091")).toBe(true);
  });

  it("rejects rebinding-style and absent hosts", () => {
    for (const h of ["evil.example", "evil.example:45091", "localhost.evil.example", "10.0.0.5", "", null]) {
      expect(isLoopbackHost(h)).toBe(false);
    }
  });
});

describe("isSafeRegex", () => {
  it("accepts ordinary merchant patterns", () => {
    for (const p of ["^SUPER", "shufersal|rami levy", "\\d{4}$", "café.*"]) {
      expect(isSafeRegex(p)).toBe(true);
    }
  });

  it("rejects nested quantifiers", () => {
    expect(isSafeRegex("(a+)+")).toBe(false);
    expect(isSafeRegex("(a*)*")).toBe(false);
  });

  it("rejects quantified overlapping alternation", () => {
    expect(isSafeRegex("(a|a)+")).toBe(false);
    expect(isSafeRegex("(?:ab|ab)*")).toBe(false);
  });

  it("rejects a quantified group with a quantified body", () => {
    expect(isSafeRegex("(?:a{10}){10}")).toBe(false);
  });

  it("rejects over-long patterns, excessive alternation, and invalid syntax", () => {
    expect(isSafeRegex("a".repeat(201))).toBe(false);
    expect(isSafeRegex(Array(22).fill("a").join("|"))).toBe(false);
    expect(isSafeRegex("(unclosed")).toBe(false);
  });
});

describe("sanitizeError", () => {
  it("redacts absolute POSIX and Windows paths", () => {
    expect(sanitizeError("failed to open /Users/alice/.local/share/kolshek/kolshek.db"))
      .not.toContain("alice");
    expect(sanitizeError("failed to open C:\\Users\\alice\\kolshek.db"))
      .not.toContain("alice");
  });

  it("strips stack frames", () => {
    expect(sanitizeError("boom at handler (/app/server.ts:12:3)")).not.toContain("server.ts");
  });

  it("leaves non-path message text intact", () => {
    expect(sanitizeError("date must be YYYY/MM/DD")).toBe("date must be YYYY/MM/DD");
    expect(sanitizeError("expected income/expense")).toBe("expected income/expense");
  });
});
