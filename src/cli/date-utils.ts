/**
 * Shared date parsing utilities for CLI commands.
 */

import { parseISO, subDays, isValid } from "date-fns";

/** Parse a date string (YYYY-MM-DD, DD/MM/YYYY, or relative "30d") → ISO date string */
export function parseDateToString(input: string): string | null {
  const relMatch = input.match(/^(\d+)d$/);
  if (relMatch) {
    return subDays(new Date(), Number(relMatch[1])).toISOString().slice(0, 10);
  }
  const ddmmyyyy = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const day = Number(ddmmyyyy[1]);
    const month = Number(ddmmyyyy[2]) - 1;
    const year = Number(ddmmyyyy[3]);
    const d = new Date(Date.UTC(year, month, day));
    if (isValid(d) && d.getUTCFullYear() === year && d.getUTCMonth() === month && d.getUTCDate() === day) {
      return d.toISOString().slice(0, 10);
    }
  }
  const iso = parseISO(input);
  if (isValid(iso)) return input;
  return null;
}

/** Parse a date string (YYYY-MM-DD, DD/MM/YYYY, or relative "30d") → Date object */
export function parseDateToDate(input: string): Date | null {
  const relMatch = input.match(/^(\d+)d$/);
  if (relMatch) {
    return subDays(new Date(), Number(relMatch[1]));
  }
  const ddmmyyyy = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const day = Number(ddmmyyyy[1]);
    const month = Number(ddmmyyyy[2]) - 1;
    const year = Number(ddmmyyyy[3]);
    const d = new Date(Date.UTC(year, month, day));
    if (isValid(d) && d.getUTCFullYear() === year && d.getUTCMonth() === month && d.getUTCDate() === day) return d;
  }
  const iso = parseISO(input);
  if (isValid(iso)) return iso;
  return null;
}
