// Credential storage layer.
//
// Three backends (checked in order):
//   1. Environment variables (for CI/automation)
//   2. OS keychain via Bun.secrets (Windows Credential Manager / macOS Keychain / Linux libsecret)
//   3. Encrypted file (AES-256-GCM fallback when keychain unavailable, e.g. WSL)
//
// Credentials are stored as base64-encoded JSON in keychain,
// or AES-256-GCM encrypted in a local file.

import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "fs";
import { join } from "path";
import { randomBytes, createCipheriv, createDecipheriv } from "crypto";
import envPaths from "env-paths";

const SERVICE = "kolshek";
const paths = envPaths("kolshek");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function targetName(companyId: string): string {
  return `${SERVICE}:${companyId}`;
}

// Base64-encode a JSON object for safe storage in credential password fields.
function encodePayload(data: Record<string, string>): string {
  return Buffer.from(JSON.stringify(data), "utf-8").toString("base64");
}

// Decode a base64-encoded JSON payload back to an object.
// Validates the parsed result is a flat Record<string, string>.
function decodePayload(encoded: string): Record<string, string> {
  const parsed: unknown = JSON.parse(Buffer.from(encoded, "base64").toString("utf-8"));
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Invalid credential payload structure");
  }
  for (const [key, val] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof val !== "string") {
      throw new Error(`Invalid credential field "${key}": expected string`);
    }
  }
  return parsed as Record<string, string>;
}

// Strip any credential values from an error message to prevent leaks.
function sanitizeError(err: unknown, secrets: string[]): Error {
  let msg = err instanceof Error ? err.message : String(err);
  for (const s of secrets) {
    if (s) msg = msg.replaceAll(s, "***");
  }
  return new Error(msg);
}

// ---------------------------------------------------------------------------
// OS keychain via Bun.secrets
// ---------------------------------------------------------------------------

async function keychainStore(target: string, encoded: string): Promise<void> {
  await Bun.secrets.set({ service: SERVICE, name: target, value: encoded });
}

async function keychainRead(target: string): Promise<string | null> {
  return Bun.secrets.get({ service: SERVICE, name: target });
}

async function keychainDelete(target: string): Promise<boolean> {
  return Bun.secrets.delete({ service: SERVICE, name: target });
}

// ---------------------------------------------------------------------------
// Encrypted file backend (AES-256-GCM, fallback when keychain unavailable)
// ---------------------------------------------------------------------------
// Two files in the data directory, both owner-only (0o600):
//   credentials.enc  — IV (12 bytes) + auth tag (16 bytes) + ciphertext
//   credentials.key  — random 256-bit key
// An attacker needs both files to recover credentials.

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function credentialsEncPath(): string {
  return join(paths.data, "credentials.enc");
}

function credentialsKeyPath(): string {
  return join(paths.data, "credentials.key");
}

function ensureDataDir(): void {
  mkdirSync(paths.data, { recursive: true, mode: process.platform !== "win32" ? 0o700 : undefined });
}

function getOrCreateKey(): Buffer {
  const keyPath = credentialsKeyPath();
  if (existsSync(keyPath)) {
    return readFileSync(keyPath);
  }
  ensureDataDir();
  const key = randomBytes(32);
  writeFileSync(keyPath, key, { mode: 0o600 });
  return key;
}

function encryptData(plaintext: string, key: Buffer): Buffer {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Layout: IV (12) + tag (16) + ciphertext
  return Buffer.concat([iv, tag, encrypted]);
}

function decryptData(blob: Buffer, key: Buffer): string {
  if (blob.length < IV_LEN + TAG_LEN) {
    throw new Error("Credential file is corrupted");
  }
  const iv = blob.subarray(0, IV_LEN);
  const tag = blob.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = blob.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext, undefined, "utf-8") + decipher.final("utf-8");
}

function loadCredentialsFile(): Record<string, Record<string, string>> {
  const encPath = credentialsEncPath();
  const keyPath = credentialsKeyPath();
  if (!existsSync(encPath) || !existsSync(keyPath)) return {};
  try {
    const key = readFileSync(keyPath);
    const blob = readFileSync(encPath);
    const json = decryptData(blob, key);
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    return parsed as Record<string, Record<string, string>>;
  } catch {
    // Decryption failed — file is corrupted or tampered with
    console.error(
      "Warning: Credential file appears corrupted or tampered with. " +
      "Stored credentials are unavailable. Re-add providers to save new credentials.",
    );
    return {};
  }
}

function saveCredentialsFile(data: Record<string, Record<string, string>>): void {
  ensureDataDir();
  const key = getOrCreateKey();
  const json = JSON.stringify(data);
  const blob = encryptData(json, key);
  writeFileSync(credentialsEncPath(), blob, { mode: 0o600 });
}

function deleteCredentialsFile(): void {
  try { unlinkSync(credentialsEncPath()); } catch { /* already gone */ }
  try { unlinkSync(credentialsKeyPath()); } catch { /* already gone */ }
}

// ---------------------------------------------------------------------------
// Environment variable backend
// ---------------------------------------------------------------------------

function getCredentialsFromEnv(companyId: string): Record<string, string> | null {
  // Try bulk JSON first
  const bulk = process.env.KOLSHEK_CREDENTIALS_JSON;
  if (bulk) {
    try {
      const parsed = JSON.parse(bulk) as Record<string, Record<string, string>>;
      if (parsed[companyId]) return parsed[companyId];
    } catch {
      // Malformed JSON — fall through to per-field lookup
    }
  }

  // Per-field env vars: KOLSHEK_{ALIAS}_{FIELD}
  // Convert dashes to underscores for env var compatibility (e.g. leumi-joint → KOLSHEK_LEUMI_JOINT_)
  const prefix = `KOLSHEK_${companyId.replace(/-/g, "_").toUpperCase()}_`;
  const fields: Record<string, string> = {};
  let found = false;
  for (const [key, val] of Object.entries(process.env)) {
    if (key.startsWith(prefix) && val) {
      const field = key.slice(prefix.length).toLowerCase();
      fields[field] = val;
      found = true;
    }
  }
  return found ? fields : null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// Non-credential env vars that should not trigger env credential source
const NON_CREDENTIAL_VARS = new Set([
  "KOLSHEK_CHROME_PATH",
  "KOLSHEK_CONCURRENCY",
  "KOLSHEK_DATA_DIR",
  "KOLSHEK_OTP",
  "KOLSHEK_NO_SANDBOX",
]);

// Determine which credential source is being used.
export function getCredentialSource(): "keychain" | "env" | "file" {
  if (process.env.KOLSHEK_CREDENTIALS_JSON) return "env";

  // Check for per-provider env vars (e.g. KOLSHEK_HAPOALIM_USERNAME)
  for (const key of Object.keys(process.env)) {
    if (
      key.startsWith("KOLSHEK_") &&
      !NON_CREDENTIAL_VARS.has(key) &&
      key !== "KOLSHEK_CREDENTIALS_JSON"
    ) {
      const parts = key.split("_");
      if (parts.length >= 3) return "env";
    }
  }

  // Check if encrypted credentials file exists (fallback)
  if (existsSync(credentialsEncPath())) return "file";

  return "keychain";
}

// Test if the OS keychain is available on this platform.
export async function hasKeychainSupport(): Promise<boolean> {
  try {
    await Bun.secrets.set({ service: SERVICE, name: "__kolshek_probe__", value: "p" });
    await Bun.secrets.delete({ service: SERVICE, name: "__kolshek_probe__" });
    return true;
  } catch {
    return false;
  }
}

// Store credentials for a provider.
// Uses keychain if available, otherwise falls back to encrypted file.
export async function storeCredentials(
  companyId: string,
  credentials: Record<string, string>,
): Promise<"keychain" | "file"> {
  const keychainOk = await hasKeychainSupport();
  if (keychainOk) {
    const target = targetName(companyId);
    const encoded = encodePayload(credentials);
    try {
      await keychainStore(target, encoded);
    } catch (err) {
      throw sanitizeError(err, [encoded, ...Object.values(credentials)]);
    }
    // Clean up stale file creds for this provider if they exist
    const fileData = loadCredentialsFile();
    if (companyId in fileData) {
      delete fileData[companyId];
      if (Object.keys(fileData).length === 0) {
        deleteCredentialsFile();
      } else {
        saveCredentialsFile(fileData);
      }
    }
    return "keychain";
  }

  // Fallback: store in AES-256-GCM encrypted file
  const all = loadCredentialsFile();
  all[companyId] = credentials;
  try {
    saveCredentialsFile(all);
  } catch (err) {
    throw sanitizeError(err, Object.values(credentials));
  }
  return "file";
}

// Retrieve credentials for a provider.
// Checks: env vars → OS keychain → credentials file.
// Returns null if no credentials are found.
export async function getCredentials(
  companyId: string,
): Promise<Record<string, string> | null> {
  // Env vars take priority (CI / automation)
  const fromEnv = getCredentialsFromEnv(companyId);
  if (fromEnv) return fromEnv;

  // OS keychain
  const target = targetName(companyId);
  try {
    const encoded = await keychainRead(target);
    if (encoded) return decodePayload(encoded);
  } catch {
    // Keychain failed — fall through to file
  }

  // Credentials file (fallback)
  const fromFile = loadCredentialsFile();
  if (fromFile[companyId]) return fromFile[companyId];

  return null;
}

// Check if credentials exist for a provider (env, keychain, or file).
export async function hasCredentials(companyId: string): Promise<boolean> {
  const fromEnv = getCredentialsFromEnv(companyId);
  if (fromEnv) return true;

  const target = targetName(companyId);
  try {
    const encoded = await keychainRead(target);
    if (encoded != null && encoded.length > 0) return true;
  } catch {
    // Keychain failed — check file
  }

  const fromFile = loadCredentialsFile();
  return companyId in fromFile;
}

// Delete stored credentials for a provider from keychain and/or file.
export async function deleteCredentials(companyId: string): Promise<void> {
  // Try keychain
  const target = targetName(companyId);
  try {
    await keychainDelete(target);
  } catch {
    // May not exist in keychain
  }

  // Also remove from encrypted file if present
  const all = loadCredentialsFile();
  if (companyId in all) {
    delete all[companyId];
    if (Object.keys(all).length === 0) {
      deleteCredentialsFile();
    } else {
      saveCredentialsFile(all);
    }
  }
}
