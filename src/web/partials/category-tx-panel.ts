// Transaction panel partial — shows transactions for a category with inline category dropdowns.

import { escapeHtml } from "../layout.js";
import { listTransactions } from "../../db/repositories/transactions.js";
import { listAllCategories } from "../../db/repositories/categories.js";
import type { TransactionWithContext } from "../../types/index.js";

export function categoryTxPanel(category: string): string {
  const isUncat = category === "Uncategorized";
  const txs = listTransactions({
    category: isUncat ? null : category,
    sort: "date",
    sortDirection: "desc",
  });

  const allCategories = listAllCategories();

  if (txs.length === 0) {
    const message = isUncat
      ? "All transactions are categorized!"
      : `No transactions in "${escapeHtml(category)}"`;
    const icon = isUncat ? "&#10003;" : "&#128203;";
    const subtext = isUncat
      ? "Every transaction has been assigned a category."
      : "Transactions moved to other categories will disappear from here.";
    return `<div id="tx-panel">
      <div class="empty-state">
        <span class="empty-icon">${icon}</span>
        <p>${message}</p>
        <p class="text-muted">${subtext}</p>
      </div>
    </div>`;
  }

  const header = `<div style="display:flex;justify-content:space-between;align-items:center;padding:0.75rem 1rem;border-bottom:1px solid var(--pico-muted-border-color);">
    <strong>${escapeHtml(category)} <span class="text-muted" style="font-weight:400;">(${txs.length})</span></strong>
  </div>`;

  const rows = txs.map((tx) => txRow(tx, category, allCategories)).join("\n");

  return `<div id="tx-panel">${header}${rows}</div>`;
}

function txRow(tx: TransactionWithContext, currentCategory: string, allCategories: string[]): string {
  const date = formatDate(tx.date);
  const amount = tx.chargedAmount;
  const amountClass = amount < 0 ? "tx-amount-expense" : "tx-amount-income";
  const amountStr = formatAmount(amount);
  const hebrewDesc = escapeHtml(tx.description);
  const englishDesc = tx.descriptionEn ? escapeHtml(tx.descriptionEn) : "";

  const catOptions = allCategories
    .map((c) => {
      const selected = c === (tx.category || "Uncategorized") ? " selected" : "";
      return `<option value="${escapeHtml(c)}"${selected}>${escapeHtml(c)}</option>`;
    })
    .join("");

  return `<div class="tx-row" id="tx-row-${tx.id}">
    <div class="tx-date">${date}</div>
    <div class="tx-desc">
      <span class="tx-desc-he" dir="rtl" lang="he">${hebrewDesc}</span>
      ${englishDesc ? `<span class="tx-desc-en">${englishDesc}</span>` : ""}
    </div>
    <div class="tx-amount ${amountClass}">${amountStr}</div>
    <select class="inline-select"
      hx-patch="/api/transactions/${tx.id}/category"
      hx-vals='{"from": "${escapeHtml(currentCategory)}"}'
      hx-target="#tx-row-${tx.id}"
      hx-swap="outerHTML"
      name="category">
      ${catOptions}
    </select>
  </div>`;
}

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

function formatAmount(amount: number): string {
  return amount.toLocaleString("he-IL", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: 2,
  });
}
