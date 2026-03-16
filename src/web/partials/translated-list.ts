// Translated transactions list -- grouped by Hebrew description with inline edit.
// Uses card-style rows matching the untranslated list design.

import { escapeHtml } from "../layout.js";
import { simpleHash } from "./utils.js";
import { listTranslatedGrouped, type TranslatedGroup } from "../../db/repositories/translations.js";

export function translatedList(): string {
  const groups = listTranslatedGrouped();

  if (groups.length === 0) {
    return `<div id="translated-list">
      <div class="flex flex-col items-center justify-center text-center py-8">
        <span class="text-3xl mb-2">&#128203;</span>
        <p class="text-sm font-medium text-zinc-700 dark:text-zinc-300">No translated transactions yet</p>
        <p class="text-zinc-500 dark:text-zinc-300 text-sm mt-1">Translate merchants above or apply translation rules.</p>
      </div>
    </div>`;
  }

  const rows = groups.map((g) => translatedRow(g)).join("\n");

  return `<div id="translated-list">${rows}</div>`;
}

function translatedRow(group: TranslatedGroup): string {
  const hebrew = escapeHtml(group.description);
  const english = escapeHtml(group.descriptionEn);
  const totalFormatted = group.totalAmount.toLocaleString("he-IL", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  const countLabel = `${group.count} tx${group.count !== 1 ? "s" : ""}`;
  const rowId = `translated-${simpleHash(group.description)}`;

  return `<form class="translate-row grid grid-cols-[minmax(140px,1fr)_auto_minmax(200px,1.2fr)_auto] gap-3 items-center p-3 mx-3 my-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all" id="${rowId}"
    hx-post="/api/translations/update"
    hx-target="#translated-list"
    hx-swap="outerHTML">
    <div class="min-w-0">
      <span class="text-right text-sm font-medium block" dir="rtl" style="unicode-bidi:isolate;">${hebrew}</span>
      <div class="text-zinc-500 dark:text-zinc-300 text-xs mt-0.5">${countLabel} &middot; ${totalFormatted}</div>
    </div>
    <div class="text-zinc-400 text-sm text-center opacity-50" aria-hidden="true">&#8594;</div>
    <div class="min-w-0">
      <input type="hidden" name="hebrew" value="${hebrew}">
      <input type="text" name="english" value="${english}" required class="m-0">
    </div>
    <button type="submit" hx-disabled-elt="this" class="btn btn-outline btn-sm">Save</button>
  </form>`;
}

