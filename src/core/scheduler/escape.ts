// Escape the five XML predefined entities so arbitrary strings
// can be safely embedded in XML text or attribute values.
export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Wrap a string in single quotes for safe embedding in shell contexts
// (crontab lines, etc). Embedded single quotes become '\'' which
// closes the quote, adds an escaped literal quote, and reopens.
export function shellQuote(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

// Escape a string for use inside systemd ExecStart= double-quoted values.
// Systemd uses C-style quoting: backslash and double-quote must be escaped.
export function systemdEscape(s: string): string {
  return '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
}

// Validate a binary path for use in OS scheduler commands.
// Rejects control characters and cmd.exe/shell metacharacters that could
// allow command injection when the path is embedded in a scheduled task.
export function validateBinaryPath(p: string): string {
  if (!p || typeof p !== "string") throw new Error("binaryPath is required");
  if (/[\n\r\0]/.test(p)) throw new Error("binaryPath contains control characters");
  if (/[&|><^%!`$]/.test(p)) throw new Error("binaryPath contains unsafe shell characters");
  return p;
}
