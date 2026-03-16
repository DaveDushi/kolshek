// Transaction panel partial -- shows transactions for a category with inline category dropdowns.

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
      <div class="flex flex-col items-center gap-2 py-12 text-center">
        <span class="text-4xl">${icon}</span>
        <p class="text-sm font-medium text-zinc-700 dark:text-zinc-300">${message}</p>
        <p class="text-zinc-500 dark:text-zinc-300 text-sm">${subtext}</p>
      </div>
    </div>`;
  }

  const header = `<div class="px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800">
    <span class="font-semibold text-sm text-zinc-900 dark:text-white">${escapeHtml(category)} <span class="text-zinc-500 dark:text-zinc-300 font-normal">(${txs.length})</span></span>
  </div>`;

  const rows = txs.map((tx) => txRow(tx, category, allCategories)).join("\n");

  return `<div id="tx-panel" class="overflow-y-auto max-h-[32rem] scrollbar-hide">${header}${rows}</div>`;
}

function txRow(tx: TransactionWithContext, currentCategory: string, allCategories: string[]): string {
  const date = formatDate(tx.date);
  const amount = tx.chargedAmount;
  const isExpense = amount < 0;
  const amountColor = isExpense
    ? "text-rose-600 dark:text-rose-400"
    : "text-emerald-600 dark:text-emerald-400";
  const amountStr = formatAmount(amount);
  const hebrewDesc = escapeHtml(tx.description);
  const englishDesc = tx.descriptionEn ? escapeHtml(tx.descriptionEn) : "";

  const catOptions = allCategories
    .map((c) => {
      const selected = c === (tx.category || "Uncategorized") ? " selected" : "";
      return `<option value="${escapeHtml(c)}"${selected}>${escapeHtml(c)}</option>`;
    })
    .join("");

  return `<div class="tx-row grid grid-cols-[4rem_1fr_auto_auto] gap-3 items-center px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors" id="tx-row-${tx.id}">
    <div class="text-xs text-zinc-500 dark:text-zinc-300 tabular-nums">${date}</div>
    <div class="min-w-0">
      <span class="block text-sm text-zinc-900 dark:text-zinc-100 truncate" dir="rtl" lang="he" style="unicode-bidi:isolate">${hebrewDesc}</span>
      ${englishDesc ? `<span class="block text-xs text-zinc-500 dark:text-zinc-300 truncate">${englishDesc}</span>` : ""}
    </div>
    <div class="font-semibold tabular-nums text-sm ${amountColor} text-right whitespace-nowrap">${amountStr}</div>
    <select class="!w-auto !py-1 !px-2 !text-xs"
      hx-patch="/api/transactions/${tx.id}/category"
      hx-vals='${escapeHtml(JSON.stringify({ from: currentCategory }))}'
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
  // Use 0 decimal places for amounts >= 10, 2 for smaller amounts (sub-shekel precision)
  const fracDigits = Math.abs(amount) >= 10 ? 0 : 2;
  return amount.toLocaleString("he-IL", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: fracDigits,
    maximumFractionDigits: fracDigits,
  });
}
