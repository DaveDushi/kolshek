// Category summary table partial — swappable tbody with rename/delete actions.

import { escapeHtml } from "../layout.js";
import { listCategoriesWithSource } from "../../db/repositories/categories.js";

export function categorySummaryTable(): string {
  const categories = listCategoriesWithSource();

  if (categories.length === 0) {
    return `<tbody id="category-summary-tbody"><tr><td colspan="5">
      <div class="empty-state">
        <span class="empty-icon">&#128203;</span>
        <p>No categories yet</p>
        <p class="text-muted">Sync your providers to see transaction categories.</p>
      </div>
    </td></tr></tbody>`;
  }

  const rows = categories
    .map((c) => {
      const isProtected = c.category === "Uncategorized";
      const encodedName = encodeURIComponent(c.category);
      const actions = isProtected
        ? `<span class="text-muted" style="font-size:0.78rem;">System</span>`
        : `<div class="actions">
            <button hx-get="/api/categories/${encodedName}/edit" hx-target="#cat-name-${cssId(c.category)}" hx-swap="innerHTML" class="outline secondary" title="Rename">&#9998;</button>
            <button hx-get="/api/categories/${encodedName}/delete-confirm" hx-target="#category-action-panel" hx-swap="innerHTML" class="outline secondary" title="Delete">&#10005;</button>
          </div>`;

      const sourceLabel = c.source === "both" ? "both" : c.source === "rules" ? "rules only" : "transactions";
      const totalFormatted = c.totalAmount.toLocaleString("he-IL", { style: "currency", currency: "ILS", minimumFractionDigits: 0 });

      return `<tr>
        <td data-label="Category" id="cat-name-${cssId(c.category)}">${escapeHtml(c.category)}</td>
        <td data-label="Transactions">${c.transactionCount}</td>
        <td data-label="Total">${totalFormatted}</td>
        <td data-label="Source"><span class="text-muted">${sourceLabel}</span></td>
        <td data-label="">${actions}</td>
      </tr>`;
    })
    .join("\n");

  return `<tbody id="category-summary-tbody">${rows}</tbody>`;
}

// Generate a CSS-safe id from a category name
function cssId(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
}
