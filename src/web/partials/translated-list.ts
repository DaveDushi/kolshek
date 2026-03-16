// Translated transactions list — grouped by Hebrew description with inline edit.

import { escapeHtml } from "../layout.js";
import { listTranslatedGrouped, type TranslatedGroup } from "../../db/repositories/translations.js";

export function translatedList(): string {
  const groups = listTranslatedGrouped();

  if (groups.length === 0) {
    return `<div id="translated-list">
      <div class="empty-state">
        <span class="empty-icon">&#128203;</span>
        <p>No translated transactions yet</p>
        <p class="text-muted">Translate merchants above or apply translation rules.</p>
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
  });
  const countLabel = `${group.count} tx${group.count !== 1 ? "s" : ""}`;
  const rowId = `translated-${simpleHash(group.description)}`;

  return `<form class="translate-row" id="${rowId}"
    hx-post="/api/translations/update"
    hx-target="#translated-list"
    hx-swap="outerHTML">
    <div class="translate-source">
      <span dir="rtl" lang="he">${hebrew}</span>
      <div class="translate-source-meta">${countLabel}, ${totalFormatted}</div>
    </div>
    <div class="translate-arrow" aria-hidden="true">&#8594;</div>
    <div class="translate-input-group">
      <input type="hidden" name="hebrew" value="${hebrew}">
      <input type="text" name="english" value="${english}" required style="margin:0;">
    </div>
    <button type="submit" hx-disabled-elt="this" class="outline" style="margin:0;padding:0.3rem 0.75rem;font-size:0.85rem;white-space:nowrap;">Save</button>
  </form>`;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}
