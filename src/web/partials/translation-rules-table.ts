// Translation rules table body partial -- returned on add/delete for HTMX swap.

import { escapeHtml } from "../layout.js";
import type { TranslationRule } from "../../db/repositories/translations.js";

export function translationRulesTableBody(rules: TranslationRule[]): string {
  if (rules.length === 0) {
    return `<tbody id="translation-rules-tbody"><tr><td colspan="4" class="px-4 py-8">
      <div class="flex flex-col items-center justify-center text-center py-4">
        <span class="text-3xl mb-2">&#127760;</span>
        <p class="text-sm font-medium text-zinc-700 dark:text-zinc-300">No translation rules defined yet</p>
        <p class="text-zinc-500 dark:text-zinc-300 text-sm mt-1">Translation rules convert Hebrew merchant names to English for easier reading.</p>
      </div>
    </td></tr></tbody>`;
  }

  const rowsHtml = rules
    .map((r) => {
      const created = new Date(r.createdAt).toLocaleDateString("en-IL");
      return `<tr class="border-b border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
        <td class="px-4 py-3 text-sm"><span class="font-medium text-zinc-900 dark:text-white">${escapeHtml(r.englishName)}</span></td>
        <td class="px-4 py-3 text-sm" dir="rtl" style="unicode-bidi:isolate;">${escapeHtml(r.matchPattern)}</td>
        <td class="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-300">${created}</td>
        <td class="px-4 py-3 text-sm text-right">
          <button class="btn btn-ghost btn-ghost-danger"
            hx-delete="/api/translations/rules/${r.id}"
            hx-target="#translation-rules-tbody"
            hx-swap="outerHTML"
            hx-confirm="Delete this rule?"
            title="Delete rule">
            &#10005; Delete
          </button>
        </td>
      </tr>`;
    })
    .join("\n");

  return `<tbody id="translation-rules-tbody">${rowsHtml}</tbody>`;
}
