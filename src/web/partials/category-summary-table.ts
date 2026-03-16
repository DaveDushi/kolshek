// Category summary table partial -- swappable tbody with rename/delete actions.
// Percentage bar for tx distribution using Tailwind utility classes.

import { escapeHtml } from "../layout.js";
import { listCategoriesWithSource } from "../../db/repositories/categories.js";

export function categorySummaryTable(): string {
  const categories = listCategoriesWithSource();

  if (categories.length === 0) {
    return `<tbody id="category-summary-tbody"><tr><td colspan="4">
      <div class="flex flex-col items-center gap-2 py-12 text-center">
        <span class="text-4xl">&#128203;</span>
        <p class="text-sm font-medium text-zinc-700 dark:text-zinc-300">No categories yet</p>
        <p class="text-zinc-500 dark:text-zinc-300 text-sm">Sync your providers to see transaction categories.</p>
      </div>
    </td></tr></tbody>`;
  }

  // Calculate total transactions for percentage bar
  const totalTx = categories.reduce((sum, c) => sum + c.transactionCount, 0);

  const rows = categories
    .map((c) => {
      const isProtected = c.category === "Uncategorized";
      const encodedName = encodeURIComponent(c.category);
      const actions = isProtected
        ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">System</span>`
        : `<div class="flex items-center gap-1">
            <button class="btn btn-ghost"
              hx-get="/api/categories/${encodedName}/edit"
              hx-target="#cat-name-${cssId(c.category)}"
              hx-swap="innerHTML"
              title="Rename category">
              &#9998; Rename
            </button>
            <button class="btn btn-ghost btn-ghost-danger"
              hx-get="/api/categories/${encodedName}/delete-confirm"
              hx-target="#category-action-panel"
              hx-swap="innerHTML"
              title="Delete category">
              &#10005; Delete
            </button>
          </div>`;

      const totalFormatted = c.totalAmount.toLocaleString("he-IL", {
        style: "currency",
        currency: "ILS",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });

      // Percentage of transactions in this category
      const pct = totalTx > 0 ? Math.round((c.transactionCount / totalTx) * 100) : 0;

      return `<tr class="border-b border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
        <td class="px-4 py-3 text-sm" id="cat-name-${cssId(c.category)}">
          <span class="font-medium text-zinc-900 dark:text-zinc-100">${escapeHtml(c.category)}</span>
        </td>
        <td class="px-4 py-3 text-sm">
          <div class="flex items-center gap-2">
            <span class="tabular-nums text-zinc-700 dark:text-zinc-300">${c.transactionCount}</span>
            <span class="inline-block w-16 h-1 rounded-full bg-zinc-200 dark:bg-zinc-700"><span class="inline-block h-1 rounded-full bg-indigo-500" style="width:${pct}%"></span></span>
            <span class="text-xs text-zinc-400 dark:text-zinc-400 tabular-nums">${pct}%</span>
          </div>
        </td>
        <td class="px-4 py-3 text-sm text-right tabular-nums font-medium text-zinc-700 dark:text-zinc-300">${totalFormatted}</td>
        <td class="px-4 py-3 text-sm text-right">${actions}</td>
      </tr>`;
    })
    .join("\n");

  return `<tbody id="category-summary-tbody">${rows}</tbody>`;
}

// Generate a CSS-safe id from a category name (handles Hebrew and other non-ASCII)
function cssId(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return `cat-${Math.abs(hash).toString(36)}`;
}
