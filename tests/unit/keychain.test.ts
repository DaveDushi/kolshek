import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { randomBytes } from "crypto";
import { _internal, getCredentialSource, resetKeychainCache } from "../../src/security/keychain.js";

const {
  validateAlias,
  encodePayload,
  decodePayload,
  sanitizeError,
  encryptData,
  decryptData,
  getCredentialsFromEnv,
  targetName,
} = _internal;

// ---------------------------------------------------------------------------
// validateAlias
// ---------------------------------------------------------------------------

describe("validateAlias", () => {
  it("accepts valid alphanumeric aliases", () => {
    expect(() => validateAlias("hapoalim")).not.toThrow();
    expect(() => validateAlias("leumi-joint")).not.toThrow();
    expect(() => validateAlias("discount_main")).not.toThrow();
    expect(() => validateAlias("Bank123")).not.toThrow();
  });

  it("rejects empty string", () => {
    expect(() => validateAlias("")).toThrow("must be 1-64 characters");
  });

  it("rejects strings longer than 64 chars", () => {
    expect(() => validateAlias("a".repeat(65))).toThrow("must be 1-64 characters");
  });

  it("accepts exactly 64 chars", () => {
    expect(() => validateAlias("a".repeat(64))).not.toThrow();
  });

  it("rejects special characters", () => {
    expect(() => validateAlias("bank:hapoalim")).toThrow("only alphanumeric");
    expect(() => validateAlias("bank/hapoalim")).toThrow("only alphanumeric");
    expect(() => validateAlias("bank hapoalim")).toThrow("only alphanumeric");
    expect(() => validateAlias("bank.hapoalim")).toThrow("only alphanumeric");
    expect(() => validateAlias("bank@hapoalim")).toThrow("only alphanumeric");
  });

  it("rejects path traversal attempts", () => {
    expect(() => validateAlias("../etc/passwd")).toThrow("only alphanumeric");
    expect(() => validateAlias("..\\windows")).toThrow("only alphanumeric");
  });

  it("rejects prototype pollution keys", () => {
    expect(() => validateAlias("__proto__")).toThrow("Reserved alias");
    expect(() => validateAlias("constructor")).toThrow("Reserved alias");
    expect(() => validateAlias("prototype")).toThrow("Reserved alias");
  });

  it("rejects null bytes and control characters", () => {
    expect(() => validateAlias("bank\0id")).toThrow("only alphanumeric");
    expect(() => validateAlias("bank\nid")).toThrow("only alphanumeric");
  });
});

// ---------------------------------------------------------------------------
// encodePayload / decodePayload roundtrip
// ---------------------------------------------------------------------------

describe("encodePayload / decodePayload", () => {
  it("roundtrips simple credentials", () => {
    const creds = { username: "user123", password: "s3cret!" };
    const encoded = encodePayload(creds);
    expect(decodePayload(encoded)).toEqual(creds);
  });

  it("roundtrips Hebrew text", () => {
    const creds = { username: "משתמש", password: "סיסמה" };
    const encoded = encodePayload(creds);
    expect(decodePayload(encoded)).toEqual(creds);
  });

  it("roundtrips empty object", () => {
    const creds = {};
    const encoded = encodePayload(creds);
    expect(decodePayload(encoded)).toEqual(creds);
  });

  it("produces valid base64 output", () => {
    const encoded = encodePayload({ key: "value" });
    expect(() => Buffer.from(encoded, "base64")).not.toThrow();
    expect(Buffer.from(encoded, "base64").toString("base64")).toBe(encoded);
  });

  it("rejects non-object payloads", () => {
    const arrayPayload = Buffer.from(JSON.stringify([1, 2, 3])).toString("base64");
    expect(() => decodePayload(arrayPayload)).toThrow("Invalid credential payload structure");

    const stringPayload = Buffer.from(JSON.stringify("hello")).toString("base64");
    expect(() => decodePayload(stringPayload)).toThrow("Invalid credential payload structure");

    const nullPayload = Buffer.from(JSON.stringify(null)).toString("base64");
    expect(() => decodePayload(nullPayload)).toThrow("Invalid credential payload structure");
  });

  it("rejects payloads with non-string values", () => {
    const payload = Buffer.from(JSON.stringify({ num: 42 })).toString("base64");
    expect(() => decodePayload(payload)).toThrow('Invalid credential field "num": expected string');
  });

  it("rejects oversized payloads", () => {
    const huge = "A".repeat(65537);
    expect(() => decodePayload(huge)).toThrow("Credential payload too large");
  });

  it("accepts payload near the size limit", () => {
    // 65536 is the base64 decode limit; build a payload whose
    // base64 encoding lands just below it (~48KB raw → ~64KB base64)
    const creds = { key: "x".repeat(48000) };
    const encoded = encodePayload(creds);
    expect(encoded.length).toBeLessThan(65536);
    expect(encoded.length).toBeGreaterThan(60000);
    expect(decodePayload(encoded)).toEqual(creds);
  });

  it("rejects invalid base64", () => {
    expect(() => decodePayload("not-valid-base64!!!")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// sanitizeError
// ---------------------------------------------------------------------------

describe("sanitizeError", () => {
  it("scrubs credential values from error message", () => {
    const err = new Error("Failed with password MyS3cret! for user admin");
    const result = sanitizeError(err, ["MyS3cret!", "admin"]);
    expect(result.message).toBe("Failed with password *** for user ***");
    expect(result.message).not.toContain("MyS3cret!");
    expect(result.message).not.toContain("admin");
  });

  it("scrubs multiple occurrences", () => {
    const err = new Error("user=admin&pass=admin");
    const result = sanitizeError(err, ["admin"]);
    expect(result.message).toBe("user=***&pass=***");
  });

  it("handles non-Error input", () => {
    const result = sanitizeError("plain string with secret123", ["secret123"]);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("plain string with ***");
  });

  it("ignores empty secrets", () => {
    const err = new Error("some error");
    const result = sanitizeError(err, ["", "", "actual"]);
    expect(result.message).toBe("some error");
  });

  it("handles no matching secrets", () => {
    const err = new Error("unrelated error");
    const result = sanitizeError(err, ["notpresent"]);
    expect(result.message).toBe("unrelated error");
  });

  it("scrubs base64-encoded values when passed", () => {
    const encoded = Buffer.from("password123").toString("base64");
    const err = new Error(`Keychain error: ${encoded}`);
    const result = sanitizeError(err, [encoded]);
    expect(result.message).not.toContain(encoded);
  });
});

// ---------------------------------------------------------------------------
// encryptData / decryptData roundtrip
// ---------------------------------------------------------------------------

describe("encryptData / decryptData", () => {
  const key = randomBytes(32);

  it("roundtrips plaintext", () => {
    const plaintext = '{"hapoalim":{"username":"user","password":"pass"}}';
    const blob = encryptData(plaintext, key);
    expect(decryptData(blob, key)).toBe(plaintext);
  });

  it("roundtrips empty string", () => {
    const blob = encryptData("", key);
    expect(decryptData(blob, key)).toBe("");
  });

  it("roundtrips Hebrew credentials", () => {
    const plaintext = '{"password":"סיסמה_בעברית"}';
    const blob = encryptData(plaintext, key);
    expect(decryptData(blob, key)).toBe(plaintext);
  });

  it("produces different ciphertext each time (random IV)", () => {
    const plaintext = "same input";
    const blob1 = encryptData(plaintext, key);
    const blob2 = encryptData(plaintext, key);
    expect(blob1).not.toEqual(blob2);
    // But both decrypt to same plaintext
    expect(decryptData(blob1, key)).toBe(plaintext);
    expect(decryptData(blob2, key)).toBe(plaintext);
  });

  it("detects tampered ciphertext", () => {
    const blob = encryptData("secret data", key);
    // Flip a byte in the ciphertext region (after IV + tag)
    const tampered = Buffer.from(blob);
    tampered[28] ^= 0xff;
    expect(() => decryptData(tampered, key)).toThrow();
  });

  it("detects tampered auth tag", () => {
    const blob = encryptData("secret data", key);
    const tampered = Buffer.from(blob);
    tampered[12] ^= 0xff; // First byte of auth tag
    expect(() => decryptData(tampered, key)).toThrow();
  });

  it("rejects truncated blob (too short for IV + tag)", () => {
    const short = Buffer.alloc(20);
    expect(() => decryptData(short, key)).toThrow("Credential file is corrupted");
  });

  it("rejects wrong key", () => {
    const blob = encryptData("secret", key);
    const wrongKey = randomBytes(32);
    expect(() => decryptData(blob, wrongKey)).toThrow();
  });

  it("blob layout: IV (12) + tag (16) + ciphertext", () => {
    const plaintext = "hello";
    const blob = encryptData(plaintext, key);
    // Minimum size: 12 (IV) + 16 (tag) + len(ciphertext)
    expect(blob.length).toBeGreaterThanOrEqual(28);
    // First 12 bytes are IV (random, non-zero in practice)
    expect(blob.subarray(0, 12).length).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// targetName
// ---------------------------------------------------------------------------

describe("targetName", () => {
  it("prefixes with service name", () => {
    expect(targetName("hapoalim")).toBe("kolshek:hapoalim");
  });

  it("preserves dashes and underscores", () => {
    expect(targetName("leumi-joint")).toBe("kolshek:leumi-joint");
    expect(targetName("discount_main")).toBe("kolshek:discount_main");
  });
});

// ---------------------------------------------------------------------------
// getCredentialsFromEnv
// ---------------------------------------------------------------------------

describe("getCredentialsFromEnv", () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    // Clean KOLSHEK_ env vars before each test
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("KOLSHEK_")) delete process.env[key];
    }
  });

  afterEach(() => {
    // Restore original env
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("KOLSHEK_")) delete process.env[key];
    }
    Object.assign(process.env, savedEnv);
  });

  it("returns null when no env vars set", () => {
    expect(getCredentialsFromEnv("hapoalim")).toBeNull();
  });

  it("reads from KOLSHEK_CREDENTIALS_JSON bulk var", () => {
    process.env.KOLSHEK_CREDENTIALS_JSON = JSON.stringify({
      hapoalim: { username: "user1", password: "pass1" },
      leumi: { username: "user2", password: "pass2" },
    });
    expect(getCredentialsFromEnv("hapoalim")).toEqual({ username: "user1", password: "pass1" });
    expect(getCredentialsFromEnv("leumi")).toEqual({ username: "user2", password: "pass2" });
    expect(getCredentialsFromEnv("discount")).toBeNull();
  });

  it("handles malformed KOLSHEK_CREDENTIALS_JSON", () => {
    process.env.KOLSHEK_CREDENTIALS_JSON = "not json";
    expect(getCredentialsFromEnv("hapoalim")).toBeNull();
  });

  it("reads per-field env vars", () => {
    process.env.KOLSHEK_HAPOALIM_USERNAME = "user1";
    process.env.KOLSHEK_HAPOALIM_PASSWORD = "pass1";
    const result = getCredentialsFromEnv("hapoalim");
    expect(result).toEqual({ username: "user1", password: "pass1" });
  });

  it("converts dashes to underscores in prefix", () => {
    process.env.KOLSHEK_LEUMI_JOINT_USERNAME = "user";
    const result = getCredentialsFromEnv("leumi-joint");
    expect(result).toEqual({ username: "user" });
  });

  it("lowercases field names", () => {
    process.env.KOLSHEK_HAPOALIM_USERNAME = "user";
    const result = getCredentialsFromEnv("hapoalim");
    expect(result).not.toBeNull();
    expect(Object.keys(result!)).toEqual(["username"]);
  });

  it("ignores env vars with empty values", () => {
    process.env.KOLSHEK_HAPOALIM_USERNAME = "";
    expect(getCredentialsFromEnv("hapoalim")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getCredentialSource
// ---------------------------------------------------------------------------

describe("getCredentialSource", () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("KOLSHEK_")) delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("KOLSHEK_")) delete process.env[key];
    }
    Object.assign(process.env, savedEnv);
  });

  it("returns 'env' when KOLSHEK_CREDENTIALS_JSON is set", () => {
    process.env.KOLSHEK_CREDENTIALS_JSON = "{}";
    expect(getCredentialSource()).toBe("env");
  });

  it("returns 'env' for per-provider env vars", () => {
    process.env.KOLSHEK_HAPOALIM_USERNAME = "user";
    expect(getCredentialSource()).toBe("env");
  });

  it("does not misidentify non-credential KOLSHEK_ vars", () => {
    process.env.KOLSHEK_CHROME_PATH = "/usr/bin/chromium";
    expect(getCredentialSource()).not.toBe("env");
  });

  it("does not misidentify KOLSHEK_OTP as credential", () => {
    process.env.KOLSHEK_OTP = "123456";
    expect(getCredentialSource()).not.toBe("env");
  });

  it("returns 'keychain' by default (no env vars, no file)", () => {
    // No KOLSHEK_ env vars and no credentials.enc file → keychain
    expect(getCredentialSource()).toBe("keychain");
  });
});

// resetKeychainCache is a trivial test-utility (sets one variable to null).
// No standalone test needed — it exists to support other tests, not to be tested itself.
