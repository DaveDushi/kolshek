// Categories page -- two sections: Category Manager (CRUD) + Transaction Triage (master-detail).

import { layout } from "../layout.js";
import { categorySummaryTable } from "../partials/category-summary-table.js";
import { categorySidebar } from "../partials/category-sidebar.js";
import { categoryTxPanel } from "../partials/category-tx-panel.js";
import { categoryRulesTableBody } from "../partials/category-rules-table.js";
import { listCategoryRules, listCategories } from "../../db/repositories/categories.js";
import { countTransactions } from "../../db/repositories/transactions.js";

export function categoriesPage(activeCategory?: string): string {
  const categories = listCategories();
  const rules = listCategoryRules();
  const totalTx = countTransactions();
  const uncatCount = countTransactions({ category: null });

  // Default to Uncategorized if it has items, otherwise first category
  const defaultCat = uncatCount > 0
    ? "Uncategorized"
    : (categories[0]?.category ?? "Uncategorized");
  const selectedCat = activeCategory ?? defaultCat;

  const body = `
    <!-- Category Manager -->
    <div class="card">
      <div class="card-header">
        <div class="flex items-center gap-2.5">
          <div class="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-600 dark:text-emerald-400"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
          </div>
          <span class="font-semibold text-sm text-zinc-900 dark:text-white">Categories</span>
        </div>
        <form class="flex items-center gap-2" hx-post="/api/categories" hx-target="#category-summary-tbody" hx-swap="outerHTML"
          hx-on::after-request="if(event.detail.successful) this.reset()">
          <input type="text" name="name" placeholder="New category..." required
            class="!w-44 !py-1.5 !text-sm">
          <button type="submit" class="btn btn-outline btn-sm">+ Add</button>
        </form>
      </div>

      <div id="category-action-panel"></div>

      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-zinc-200 dark:border-zinc-800">
            <th class="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-2.5 text-left">Category</th>
            <th class="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-2.5 text-left">Transactions</th>
            <th class="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-2.5 text-right">Total</th>
            <th class="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-2.5"></th>
          </tr>
        </thead>
        ${categorySummaryTable()}
      </table>
    </div>

    <!-- Transaction Triage -->
    <div class="card mt-6">
      <div class="card-header">
        <div class="flex items-center gap-2.5">
          <div class="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-900/20">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-indigo-600 dark:text-indigo-400"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          </div>
          <span class="font-semibold text-sm text-zinc-900 dark:text-white">Transactions</span>
          ${uncatCount > 0 ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">${uncatCount} uncategorized</span>` : ""}
          <span class="text-zinc-400 dark:text-zinc-400 text-xs font-normal">${totalTx} total</span>
        </div>
      </div>

      ${totalTx === 0
        ? `<div class="flex flex-col items-center gap-3 py-14 text-center">
            <div class="flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 mb-1">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-zinc-400 dark:text-zinc-500"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            </div>
            <p class="text-sm font-semibold text-zinc-800 dark:text-zinc-200">No transactions yet</p>
            <p class="text-zinc-500 dark:text-zinc-300 text-sm max-w-xs">Sync your bank accounts from the <a href="/providers" class="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">Providers</a> page to see transactions here.</p>
          </div>`
        : `<div class="grid grid-cols-[14rem_1fr] gap-0 divide-x divide-zinc-200 dark:divide-zinc-800 p-0">
            <div class="bg-zinc-50/50 dark:bg-zinc-900/30">${categorySidebar(selectedCat)}</div>
            ${categoryTxPanel(selectedCat)}
          </div>`
      }
    </div>

    <!-- Category Rules (collapsible) -->
    <div class="card mt-6">
      <details${rules.length === 0 ? " open" : ""}>
        <summary class="card-header cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
          <div class="flex items-center gap-2.5">
            <div class="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-900/20">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-amber-600 dark:text-amber-400"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </div>
            <span class="font-semibold text-sm text-zinc-900 dark:text-white">Category Rules</span>
            <span class="inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 tabular-nums">${rules.length}</span>
          </div>
          <svg class="w-4 h-4 text-zinc-400 transition-transform [[open]>&]:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </summary>
        <div class="p-5">
          <div class="flex justify-end gap-2 mb-3">
            <form class="flex items-center gap-2" hx-post="/api/categories/apply" hx-target="#category-summary-tbody" hx-swap="outerHTML">
              <select name="scope" class="!w-auto !py-1 !text-xs !px-2">
                <option value="uncategorized">Uncategorized only</option>
                <option value="all">All transactions</option>
              </select>
              <button type="submit" class="btn btn-primary btn-sm" hx-disabled-elt="this">Apply</button>
            </form>
          </div>

          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-zinc-200 dark:border-zinc-800">
                <th class="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-2.5 text-left">Category</th>
                <th class="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-2.5 text-left">Conditions</th>
                <th class="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-2.5 text-right">Priority</th>
                <th class="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-2.5"></th>
              </tr>
            </thead>
            ${categoryRulesTableBody(rules)}
          </table>

          <details class="mt-4">
            <summary class="btn btn-outline w-full justify-center cursor-pointer list-none [&::-webkit-details-marker]:hidden">+ Add Rule</summary>
            <form class="mt-4 space-y-4" hx-post="/api/categories/rules" hx-target="#category-rules-tbody" hx-swap="outerHTML"
              hx-on::after-request="if(event.detail.successful) this.reset()">
              <div class="grid grid-cols-2 gap-4">
                <label>
                  Category
                  <input type="text" name="category" placeholder="e.g. Groceries" required>
                </label>
                <label>
                  Priority <small class="text-zinc-500 dark:text-zinc-300 text-xs font-normal">(higher = first)</small>
                  <input type="number" name="priority" value="10">
                </label>
              </div>
              <fieldset class="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4">
                <legend class="text-sm font-semibold text-zinc-700 dark:text-zinc-300 px-2">Conditions</legend>
                <div class="grid grid-cols-2 gap-4">
                  <label>
                    Description pattern
                    <input type="text" name="descriptionPattern" placeholder="e.g. &#1513;&#1493;&#1508;&#1512;&#1505;&#1500;">
                  </label>
                  <label>
                    Match mode
                    <select name="descriptionMode">
                      <option value="substring">Contains (substring)</option>
                      <option value="exact">Exact match</option>
                      <option value="regex">Regex</option>
                    </select>
                  </label>
                </div>
                <div class="grid grid-cols-2 gap-4 mt-3">
                  <label>
                    Memo pattern <small class="text-zinc-500 dark:text-zinc-300 text-xs font-normal">(optional)</small>
                    <input type="text" name="memoPattern">
                  </label>
                  <label>
                    Direction <small class="text-zinc-500 dark:text-zinc-300 text-xs font-normal">(optional)</small>
                    <select name="direction">
                      <option value="">Any</option>
                      <option value="debit">Expense (debit)</option>
                      <option value="credit">Income (credit)</option>
                    </select>
                  </label>
                </div>
              </fieldset>
              <button type="submit" class="btn btn-primary" hx-disabled-elt="this">Add Rule</button>
            </form>
          </details>
        </div>
      </details>
    </div>`;

  return layout("Categories", "/categories", body);
}
