import { describe, it, expect } from "vitest";
import { computeAuthStatus } from "../../src/core/auth-status.js";

describe("computeAuthStatus", () => {
  it("returns 'no' when no credentials exist", () => {
    expect(computeAuthStatus(false, null, false)).toBe("no");
    expect(computeAuthStatus(false, "success", true)).toBe("no");
    expect(computeAuthStatus(false, "error", true, 5)).toBe("no");
  });

  it("returns 'pending' when credentials exist but no sync has completed", () => {
    expect(computeAuthStatus(true, null, false)).toBe("pending");
  });

  it("returns 'connected' when latest sync succeeded", () => {
    expect(computeAuthStatus(true, "success", true)).toBe("connected");
    expect(computeAuthStatus(true, "success", false)).toBe("connected");
  });

  it("returns 'connected' after a single failure (transient)", () => {
    // One failure should NOT flip to expired — Israeli bank sites often have transient errors
    expect(computeAuthStatus(true, "error", true, 1)).toBe("connected");
  });

  it("returns 'expired' only after 2+ consecutive failures with prior success", () => {
    expect(computeAuthStatus(true, "error", true, 2)).toBe("expired");
    expect(computeAuthStatus(true, "error", true, 5)).toBe("expired");
  });

  it("returns 'pending' when latest sync failed but never succeeded before", () => {
    expect(computeAuthStatus(true, "error", false, 1)).toBe("pending");
    expect(computeAuthStatus(true, "error", false, 3)).toBe("pending");
  });

  it("defaults consecutiveFailures to 0 (backward compat)", () => {
    // Without explicit failures count, a single error with prior success stays connected
    expect(computeAuthStatus(true, "error", true)).toBe("connected");
  });
});
