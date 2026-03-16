// Category sidebar partial -- clickable list with counts.

import { escapeHtml } from "../layout.js";
import { listCategories } from "../../db/repositories/categories.js";

export function categorySidebar(activeCategory?: string): string {
  const categories = listCategories();

  if (categories.length === 0) {
    return `<div id="category-sidebar" class="py-4 px-3">
      <p class="text-zinc-500 dark:text-zinc-300 text-sm">No transactions yet. Sync your providers first.</p>
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

      // Build class list for the sidebar item
      const baseClasses = "category-item flex items-center justify-between px-3 py-2 text-sm border-l-[3px] transition-colors cursor-pointer no-underline";
      const hoverClasses = "hover:bg-zinc-100 dark:hover:bg-zinc-800/50";
      let stateClasses: string;
      if (isActive && isUncat) {
        stateClasses = "bg-amber-50 dark:bg-amber-900/20 border-l-amber-500 font-semibold text-zinc-900 dark:text-white";
      } else if (isActive) {
        stateClasses = "bg-indigo-50 dark:bg-indigo-900/20 border-l-indigo-600 font-semibold text-zinc-900 dark:text-white";
      } else if (isUncat) {
        stateClasses = "border-l-amber-400/50 text-zinc-700 dark:text-zinc-300";
      } else {
        stateClasses = "border-l-transparent text-zinc-700 dark:text-zinc-300";
      }

      const encodedCat = encodeURIComponent(c.category);
      return `<li>
        <a class="${baseClasses} ${hoverClasses} ${stateClasses}"
          href="/categories?cat=${encodedCat}"
          hx-get="/api/categories/transactions?cat=${encodedCat}"
          hx-target="#tx-panel"
          hx-swap="innerHTML"
          hx-push-url="/categories?cat=${encodedCat}"
          hx-on::after-request="document.querySelectorAll('.category-item').forEach(function(el){el.classList.remove('active')});this.classList.add('active')">
          <span class="truncate">${escapeHtml(c.category)}</span>
          <span class="inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 text-xs font-semibold rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 tabular-nums">${c.transactionCount}</span>
        </a>
      </li>`;
    })
    .join("\n");

  return `<div id="category-sidebar" class="py-2 overflow-y-auto max-h-[32rem] scrollbar-hide">
    <ul class="flex flex-col">${items}</ul>
  </div>`;
}
