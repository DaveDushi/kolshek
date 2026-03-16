// Category sidebar partial — clickable list with counts.

import { escapeHtml } from "../layout.js";
import { listCategories } from "../../db/repositories/categories.js";

export function categorySidebar(activeCategory?: string): string {
  const categories = listCategories();

  if (categories.length === 0) {
    return `<div id="category-sidebar" class="category-sidebar">
      <p class="text-muted" style="padding:0.75rem;">No transactions yet. Sync your providers first.</p>
    </div>`;
  }

  // Pin Uncategorized to top
  const uncategorized = categories.find((c) => c.category === "Uncategorized");
  const rest = categories.filter((c) => c.category !== "Uncategorized");

  const sorted = uncategorized ? [uncategorized, ...rest] : rest;
  const active = activeCategory ?? (uncategorized && uncategorized.transactionCount > 0 ? "Uncategorized" : sorted[0]?.category);

  const items = sorted
    .map((c) => {
      const isActive = c.category === active;
      const isUncat = c.category === "Uncategorized";
      const classes = ["category-item"];
      if (isActive) classes.push("active");
      if (isUncat) classes.push("uncategorized");

      const encodedCat = encodeURIComponent(c.category);
      return `<li>
        <a class="${classes.join(" ")}"
          href="/categories?cat=${encodedCat}"
          hx-get="/api/categories/transactions?cat=${encodedCat}"
          hx-target="#tx-panel"
          hx-swap="innerHTML"
          hx-push-url="/categories?cat=${encodedCat}"
          hx-on::after-request="document.querySelectorAll('.category-item').forEach(function(el){el.classList.remove('active')});this.classList.add('active')">
          <span>${escapeHtml(c.category)}</span>
          <span class="cat-count">${c.transactionCount}</span>
        </a>
      </li>`;
    })
    .join("\n");

  return `<div id="category-sidebar" class="category-sidebar">
    <ul class="category-list">${items}</ul>
  </div>`;
}
