// Credential storage layer.
//
// Three backends (checked in order):
//   1. Environment variables (for CI/automation)
//   2. OS keychain (Windows Credential Manager / macOS Keychain / Linux secret-tool)
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

/** Base64-encode a JSON object for safe storage in credential password fields. */
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

/** Strip any credential values from an error message to prevent leaks. */
function sanitizeError(err: unknown, secrets: string[]): Error {
  let msg = err instanceof Error ? err.message : String(err);
  for (const s of secrets) {
    if (s) msg = msg.replaceAll(s, "***");
  }
  return new Error(msg);
}

/** Run a subprocess and return stdout. Throws on non-zero exit. */
async function run(
  cmd: string[],
  stdin?: string,
): Promise<string> {
  const proc = Bun.spawn(cmd, {
    stdout: "pipe",
    stderr: "pipe",
    stdin: stdin !== undefined ? "pipe" : undefined,
  });

  if (stdin !== undefined && proc.stdin) {
    proc.stdin.write(stdin);
    proc.stdin.end();
  }

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0) {
    throw new Error(`Command failed (exit ${exitCode}): ${stderr.trim() || stdout.trim()}`);
  }
  return stdout;
}

// ---------------------------------------------------------------------------
// Windows — PowerShell + advapi32 CredRead / CredWrite / CredDelete
// ---------------------------------------------------------------------------

const WIN_PS_PREAMBLE = `
Add-Type -Namespace Win32 -Name Cred -UsingNamespace System.Text -MemberDefinition @'
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct CREDENTIAL {
    public int Flags;
    public int Type;
    public string TargetName;
    public string Comment;
    public long LastWritten;
    public int CredentialBlobSize;
    public IntPtr CredentialBlob;
    public int Persist;
    public int AttributeCount;
    public IntPtr Attributes;
    public string TargetAlias;
    public string UserName;
  }

  [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool CredRead(string target, int type, int reservedFlag, out IntPtr credential);

  [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool CredWrite([In] ref CREDENTIAL credential, [In] uint flags);

  [DllImport("advapi32.dll", SetLastError = true)]
  public static extern bool CredDelete(string target, int type, int flags);

  [DllImport("advapi32.dll", SetLastError = true)]
  public static extern void CredFree(IntPtr cred);
'@
`;

/** Escape a string for safe embedding in a PowerShell double-quoted string */
function escapePsString(s: string): string {
  return s
    .replace(/\0/g, "")           // strip null bytes
    .replace(/[`"$]/g, "`$&")
    .replace(/\r/g, "`r")
    .replace(/\n/g, "`n");
}

function winStoreScript(target: string, encoded: string): string {
  const safeTarget = escapePsString(target);
  const safeEncoded = escapePsString(encoded);
  return `${WIN_PS_PREAMBLE}
$bytes = [System.Text.Encoding]::Unicode.GetBytes("${safeEncoded}")
$cred = New-Object Win32.Cred+CREDENTIAL
$cred.Type = 1          # CRED_TYPE_GENERIC
$cred.TargetName = "${safeTarget}"
$cred.UserName = "${SERVICE}"
$cred.Persist = 2       # CRED_PERSIST_LOCAL_MACHINE
$cred.CredentialBlobSize = $bytes.Length
$cred.CredentialBlob = [Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
[Runtime.InteropServices.Marshal]::Copy($bytes, 0, $cred.CredentialBlob, $bytes.Length)
$ok = [Win32.Cred]::CredWrite([ref]$cred, 0)
[Runtime.InteropServices.Marshal]::FreeHGlobal($cred.CredentialBlob)
if (-not $ok) { throw "CredWrite failed: $([Runtime.InteropServices.Marshal]::GetLastWin32Error())" }
`;
}

function winReadScript(target: string): string {
  const safeTarget = escapePsString(target);
  return `${WIN_PS_PREAMBLE}
$ptr = [IntPtr]::Zero
$ok = [Win32.Cred]::CredRead("${safeTarget}", 1, 0, [ref]$ptr)
if (-not $ok) { exit 1 }
$cred = [Runtime.InteropServices.Marshal]::PtrToStructure($ptr, [Type][Win32.Cred+CREDENTIAL])
$size = $cred.CredentialBlobSize
$bytes = New-Object byte[] $size
[Runtime.InteropServices.Marshal]::Copy($cred.CredentialBlob, $bytes, 0, $size)
[Win32.Cred]::CredFree($ptr)
[System.Text.Encoding]::Unicode.GetString($bytes)
`;
}

function winDeleteScript(target: string): string {
  const safeTarget = escapePsString(target);
  return `${WIN_PS_PREAMBLE}
$ok = [Win32.Cred]::CredDelete("${safeTarget}", 1, 0)
if (-not $ok) { throw "CredDelete failed: $([Runtime.InteropServices.Marshal]::GetLastWin32Error())" }
`;
}

async function winStore(target: string, encoded: string): Promise<void> {
  // Pass script via stdin to avoid exposing credentials in process command line
  await run(["powershell", "-NoProfile", "-NonInteractive", "-Command", "-"], winStoreScript(target, encoded));
}

async function winRead(target: string): Promise<string | null> {
  try {
    const out = await run(["powershell", "-NoProfile", "-NonInteractive", "-Command", "-"], winReadScript(target));
    return out.trim();
  } catch {
    return null;
  }
}

async function winDelete(target: string): Promise<void> {
  await run(["powershell", "-NoProfile", "-NonInteractive", "-Command", "-"], winDeleteScript(target));
}

async function winHasKeychain(): Promise<boolean> {
  try {
    await run(["powershell", "-NoProfile", "-NonInteractive", "-Command", "echo ok"]);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// macOS — security CLI
// ---------------------------------------------------------------------------

async function macStore(target: string, encoded: string): Promise<void> {
  // Delete first (update semantics — add-generic-password fails if it already exists)
  try {
    await run(["security", "delete-generic-password", "-s", SERVICE, "-a", target]);
  } catch {
    // may not exist yet — that's fine
  }
  // Pass password via stdin to avoid exposing credentials in process argument list
  await run(["security", "add-generic-password", "-s", SERVICE, "-a", target, "-w"], encoded);
}

async function macRead(target: string): Promise<string | null> {
  try {
    const out = await run(["security", "find-generic-password", "-s", SERVICE, "-a", target, "-w"]);
    return out.trim();
  } catch {
    return null;
  }
}

async function macDelete(target: string): Promise<void> {
  await run(["security", "delete-generic-password", "-s", SERVICE, "-a", target]);
}

async function macHasKeychain(): Promise<boolean> {
  try {
    await run(["security", "help"]);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Linux — secret-tool CLI (freedesktop Secret Service)
// ---------------------------------------------------------------------------

async function linuxStore(target: string, encoded: string): Promise<void> {
  await run(
    ["secret-tool", "store", "--label", target, "service", SERVICE, "account", target],
    encoded,
  );
}

async function linuxRead(target: string): Promise<string | null> {
  try {
    const out = await run(["secret-tool", "lookup", "service", SERVICE, "account", target]);
    return out.trim();
  } catch {
    return null;
  }
}

async function linuxDelete(target: string): Promise<void> {
  await run(["secret-tool", "clear", "service", SERVICE, "account", target]);
}

async function linuxHasKeychain(): Promise<boolean> {
  try {
    await run(["which", "secret-tool"]);
    return true;
  } catch {
    return false;
  }
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
// Platform dispatch
// ---------------------------------------------------------------------------

type Platform = "win32" | "darwin" | "linux";

function getPlatform(): Platform {
  const p = process.platform;
  if (p === "win32" || p === "darwin" || p === "linux") return p;
  throw new Error(`Unsupported platform for keychain: ${p}`);
}

interface KeychainBackend {
  store(target: string, encoded: string): Promise<void>;
  read(target: string): Promise<string | null>;
  delete(target: string): Promise<void>;
  hasKeychain(): Promise<boolean>;
}

const backends: Record<Platform, KeychainBackend> = {
  win32: { store: winStore, read: winRead, delete: winDelete, hasKeychain: winHasKeychain },
  darwin: { store: macStore, read: macRead, delete: macDelete, hasKeychain: macHasKeychain },
  linux: { store: linuxStore, read: linuxRead, delete: linuxDelete, hasKeychain: linuxHasKeychain },
};

function backend(): KeychainBackend {
  return backends[getPlatform()];
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

/**
 * Determine which credential source is being used.
 * Returns 'env' if KOLSHEK_CREDENTIALS_JSON or any KOLSHEK_*_USERNAME/PASSWORD
 * env var is set; otherwise returns 'keychain'.
 */
/** Non-credential env vars that should not trigger env credential source */
const NON_CREDENTIAL_VARS = new Set([
  "KOLSHEK_CHROME_PATH",
  "KOLSHEK_CONCURRENCY",
  "KOLSHEK_DATA_DIR",
  "KOLSHEK_OTP",
  "KOLSHEK_NO_SANDBOX",
]);

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

/**
 * Test if the OS keychain is available on this platform.
 */
export async function hasKeychainSupport(): Promise<boolean> {
  try {
    return await backend().hasKeychain();
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
      await backend().store(target, encoded);
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
    const encoded = await backend().read(target);
    if (encoded) return decodePayload(encoded);
  } catch {
    // Keychain failed — fall through to file
  }

  // Credentials file (varlock fallback)
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
    const encoded = await backend().read(target);
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
    await backend().delete(target);
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
