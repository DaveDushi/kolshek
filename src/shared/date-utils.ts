// Shared date parsing utilities — pure functions, no side effects.
// Importable from CLI, services, web server, or anywhere else.

import { parseISO, subDays, isValid } from "date-fns";

// Parse a date string (YYYY-MM-DD, DD/MM/YYYY, or relative "30d") -> ISO date string
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

// Parse a date string (YYYY-MM-DD, DD/MM/YYYY, or relative "30d") -> Date object
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

export interface MonthRange {
  from: string;
  to: string;
  label: string;
}

// Parse month input ("current", "prev", "-3", "2026-03") -> date range for that month
export function parseMonthToRange(input?: string): MonthRange | null {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();

  if (input && input !== "current") {
    if (input === "prev") {
      month -= 1;
    } else if (/^-\d+$/.test(input)) {
      month -= Number(input.slice(1));
    } else if (/^\d{4}-\d{2}$/.test(input)) {
      const parts = input.split("-");
      year = Number(parts[0]);
      month = Number(parts[1]) - 1;
    } else {
      // Fall back: try parsing as a regular date and use its month
      const d = parseDateToDate(input);
      if (d) {
        year = d.getFullYear();
        month = d.getMonth();
      } else {
        return null;
      }
    }
  }

  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));

  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
    label: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`,
  };
}

// Convert "YYYY-MM" -> { from: "YYYY-MM-01", to: "YYYY-MM-{lastDay}" }
// Used by web server endpoints that receive month as a query param.
export function monthToDateRange(month: string): { from: string; to: string } {
  const from = month + "-01";
  const [year, mon] = month.split("-").map(Number);
  const lastDay = new Date(year, mon, 0).getDate();
  const to = `${month}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

// Compute "from" date string for N months ago (for trends/insights lookback).
export function monthsAgoToFrom(months: number): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - months, 1)
    .toISOString()
    .slice(0, 10);
}
