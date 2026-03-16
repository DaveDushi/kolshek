// Shared database utilities.

// Escape SQL LIKE wildcards so they are treated as literals.
export function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, "\\$&");
}
