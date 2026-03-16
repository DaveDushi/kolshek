// Untranslated transactions list -- grouped by Hebrew description with inline translate forms.
// Uses card-style rows with improved visual hierarchy for Hebrew->English mapping.

import { escapeHtml } from "../layout.js";
import { simpleHash } from "./utils.js";
import { listUntranslatedGrouped, type UntranslatedGroup } from "../../db/repositories/translations.js";

export function untranslatedList(): string {
  const groups = listUntranslatedGrouped();

  if (groups.length === 0) {
    return `<div id="untranslated-list">
      <div class="flex flex-col items-center justify-center text-center py-8">
        <span class="text-3xl mb-2">&#10003;</span>
        <p class="text-sm font-medium text-zinc-700 dark:text-zinc-300">All translated!</p>
        <p class="text-zinc-500 dark:text-zinc-300 text-sm mt-1">Every transaction has an English name.</p>
      </div>
    </div>`;
  }

  const rows = groups.map((g) => untranslatedRow(g)).join("\n");

  return `<div id="untranslated-list">${rows}</div>`;
}

function untranslatedRow(group: UntranslatedGroup): string {
  const hebrew = escapeHtml(group.description);
  // Use base64url-safe encoding for the Hebrew description in form data
  const totalFormatted = group.totalAmount.toLocaleString("he-IL", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  const countLabel = `${group.count} tx${group.count !== 1 ? "s" : ""}`;
  // Use the raw description as form value (URL-encoded by HTMX automatically)
  const rowId = `translate-${simpleHash(group.description)}`;

  return `<form class="translate-row grid grid-cols-[minmax(140px,1fr)_auto_minmax(200px,1.2fr)_auto] gap-3 items-center p-3 mx-3 my-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all" id="${rowId}"
    hx-post="/api/translations/translate"
    hx-target="#${rowId}"
    hx-swap="outerHTML">
    <div class="min-w-0">
      <span class="text-right text-sm font-medium block" dir="rtl" style="unicode-bidi:isolate;">${hebrew}</span>
      <div class="text-zinc-500 dark:text-zinc-300 text-xs mt-0.5">${countLabel} &middot; ${totalFormatted}</div>
    </div>
    <div class="text-zinc-400 text-sm text-center opacity-50" aria-hidden="true">&#8594;</div>
    <div class="flex items-center gap-2 min-w-0">
      <input type="hidden" name="hebrew" value="${hebrew}">
      <input type="text" name="english" placeholder="English name..." required class="m-0 flex-1">
      <label class="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-300 whitespace-nowrap cursor-pointer" title="Also create a translation rule for future transactions"><input type="checkbox" name="createRule" value="1"> rule</label>
    </div>
    <button type="submit" hx-disabled-elt="this" class="btn btn-outline btn-sm">Save</button>
  </form>`;
}

