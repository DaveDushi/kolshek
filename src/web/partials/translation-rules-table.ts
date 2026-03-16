// Translation rules table body partial — returned on add/delete for HTMX swap.

import { escapeHtml } from "../layout.js";

export interface TranslationRule {
  id: number;
  englishName: string;
  matchPattern: string;
  createdAt: string;
}

export function translationRulesTableBody(rules: TranslationRule[]): string {
  if (rules.length === 0) {
    return `<tbody id="translation-rules-tbody"><tr><td colspan="4">
      <div class="empty-state">
        <span class="empty-icon">&#127760;</span>
        <p>No translation rules defined yet</p>
        <p class="text-muted">Translation rules convert Hebrew merchant names to English for easier reading.</p>
      </div>
    </td></tr></tbody>`;
  }

  const rowsHtml = rules
    .map((r) => {
      const created = new Date(r.createdAt).toLocaleDateString("en-IL");
      return `<tr>
        <td data-label="English Name">${escapeHtml(r.englishName)}</td>
        <td data-label="Match Pattern">${escapeHtml(r.matchPattern)}</td>
        <td data-label="Created">${created}</td>
        <td data-label="" class="actions">
          <button hx-delete="/api/translations/rules/${r.id}" hx-target="#translation-rules-tbody" hx-swap="outerHTML" hx-confirm="Delete this rule?" class="outline secondary" title="Delete rule">&#10005;</button>
        </td>
      </tr>`;
    })
    .join("\n");

  return `<tbody id="translation-rules-tbody">${rowsHtml}</tbody>`;
}
