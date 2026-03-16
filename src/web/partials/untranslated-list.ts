// Untranslated transactions list — grouped by Hebrew description with inline translate forms.

import { escapeHtml } from "../layout.js";
import { listUntranslatedGrouped, type UntranslatedGroup } from "../../db/repositories/translations.js";

export function untranslatedList(): string {
  const groups = listUntranslatedGrouped();

  if (groups.length === 0) {
    return `<div id="untranslated-list">
      <div class="empty-state">
        <span class="empty-icon">&#10003;</span>
        <p>All translated!</p>
        <p class="text-muted">Every transaction has an English name.</p>
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
  });
  const countLabel = `${group.count} tx${group.count !== 1 ? "s" : ""}`;
  // Use the raw description as form value (URL-encoded by HTMX automatically)
  const rowId = `translate-${simpleHash(group.description)}`;

  return `<form class="translate-row" id="${rowId}"
    hx-post="/api/translations/translate"
    hx-target="#${rowId}"
    hx-swap="outerHTML">
    <div class="translate-source">
      <span dir="rtl" lang="he">${hebrew}</span>
      <div class="translate-source-meta">${countLabel}, ${totalFormatted}</div>
    </div>
    <div class="translate-arrow" aria-hidden="true">&#8594;</div>
    <div class="translate-input-group">
      <input type="hidden" name="hebrew" value="${hebrew}">
      <input type="text" name="english" placeholder="English name..." required style="margin:0;">
      <label><input type="checkbox" name="createRule" value="1"> rule</label>
    </div>
    <button type="submit" hx-disabled-elt="this" class="outline" style="margin:0;padding:0.3rem 0.75rem;font-size:0.85rem;white-space:nowrap;">Save</button>
  </form>`;
}

// Simple hash for generating unique row IDs from Hebrew strings
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}
