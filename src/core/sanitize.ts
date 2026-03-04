/** Strip credential values from error messages to prevent leaks. */
export function sanitizeErrorMessage(
  message: string,
  credentials: Record<string, string>,
): string {
  let safe = message;
  for (const value of Object.values(credentials)) {
    if (value) {
      safe = safe.replaceAll(value, "***");
      safe = safe.replaceAll(encodeURIComponent(value), "***");
    }
  }
  return safe;
}
