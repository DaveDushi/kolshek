// Categories page — two sections: Category Manager (CRUD) + Transaction Triage (master-detail).

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
    <article>
      <header style="display:flex;justify-content:space-between;align-items:center;">
        <strong>Categories</strong>
        <form hx-post="/api/categories" hx-target="#category-summary-tbody" hx-swap="outerHTML"
          hx-on::after-request="if(event.detail.successful) this.reset()"
          style="display:flex;gap:0.5rem;margin:0;">
          <input type="text" name="name" placeholder="New category name..." required
            style="margin:0;padding:0.3rem 0.6rem;font-size:0.85rem;height:auto;min-width:10rem;">
          <button type="submit" class="outline" style="margin:0;padding:0.3rem 0.75rem;font-size:0.85rem;white-space:nowrap;">+ Add</button>
        </form>
      </header>

      <div id="category-action-panel"></div>

      <table role="grid" class="card-table" style="margin:0;">
        <thead>
          <tr>
            <th>Category</th>
            <th>Transactions</th>
            <th>Total</th>
            <th>Source</th>
            <th></th>
          </tr>
        </thead>
        ${categorySummaryTable()}
      </table>
    </article>

    <!-- Transaction Triage -->
    <article style="padding:0;overflow:visible;">
      <header>
        <strong>Transactions</strong>
        <span class="text-muted" style="font-weight:400;margin-left:0.5rem;">${totalTx} total${uncatCount > 0 ? `, ${uncatCount} uncategorized` : ""}</span>
      </header>

      ${totalTx === 0
        ? `<div class="empty-state">
            <span class="empty-icon">&#128176;</span>
            <p>No transactions yet</p>
            <p class="text-muted">Sync your bank accounts from the <a href="/providers">Providers</a> page to see transactions here.</p>
          </div>`
        : `<div class="categories-layout" style="padding:1rem;">
            ${categorySidebar(selectedCat)}
            ${categoryTxPanel(selectedCat)}
          </div>`
      }
    </article>

    <!-- Category Rules (collapsible) -->
    <article>
      <details${rules.length === 0 ? " open" : ""}>
        <summary style="padding:0.85rem 1.25rem;cursor:pointer;font-weight:600;font-size:0.95rem;">
          Category Rules <span class="text-muted" style="font-weight:400;">(${rules.length})</span>
        </summary>
        <div style="padding:0 1.25rem 1rem;">
          <div style="display:flex;justify-content:flex-end;gap:0.5rem;margin-bottom:0.75rem;">
            <form hx-post="/api/categories/apply" hx-target="#category-summary-tbody" hx-swap="outerHTML" style="display:flex;gap:0.5rem;margin:0;">
              <select name="scope" style="margin:0;font-size:0.85rem;padding:0.3rem;height:auto;">
                <option value="uncategorized">Uncategorized only</option>
                <option value="all">All transactions</option>
              </select>
              <button type="submit" hx-disabled-elt="this" style="margin:0;padding:0.3rem 0.75rem;font-size:0.85rem;white-space:nowrap;">Apply</button>
            </form>
          </div>

          <table role="grid" class="card-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Conditions</th>
                <th>Priority</th>
                <th></th>
              </tr>
            </thead>
            ${categoryRulesTableBody(rules)}
          </table>

          <details style="margin-top:1rem;">
            <summary role="button" class="outline" style="text-align:center;">+ Add Rule</summary>
            <form hx-post="/api/categories/rules" hx-target="#category-rules-tbody" hx-swap="outerHTML"
              hx-on::after-request="if(event.detail.successful) this.reset()">
              <div class="grid">
                <label>
                  Category
                  <input type="text" name="category" placeholder="e.g. Groceries" required>
                </label>
                <label>
                  Priority <small class="text-muted">(higher = first)</small>
                  <input type="number" name="priority" value="10">
                </label>
              </div>
              <fieldset>
                <legend>Conditions</legend>
                <div class="grid">
                  <label>
                    Description pattern
                    <input type="text" name="descriptionPattern" placeholder="e.g. שופרסל">
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
                <div class="grid">
                  <label>
                    Memo pattern <small class="text-muted">(optional)</small>
                    <input type="text" name="memoPattern">
                  </label>
                  <label>
                    Direction <small class="text-muted">(optional)</small>
                    <select name="direction">
                      <option value="">Any</option>
                      <option value="debit">Expense (debit)</option>
                      <option value="credit">Income (credit)</option>
                    </select>
                  </label>
                </div>
              </fieldset>
              <button type="submit" hx-disabled-elt="this">Add Rule</button>
            </form>
          </details>
        </div>
      </details>
    </article>`;

  return layout("Categories", "/categories", body);
}
