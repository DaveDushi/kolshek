// Category rules table body partial -- returned on add/delete for HTMX swap.

import { escapeHtml } from "../layout.js";
import type { CategoryRule } from "../../types/index.js";

export function categoryRulesTableBody(rules: CategoryRule[]): string {
  if (rules.length === 0) {
    return `<tbody id="category-rules-tbody"><tr><td colspan="4">
      <div class="flex flex-col items-center gap-2 py-12 text-center">
        <span class="text-4xl">&#128203;</span>
        <p class="text-sm font-medium text-zinc-700 dark:text-zinc-300">No rules defined yet</p>
        <p class="text-zinc-500 dark:text-zinc-300 text-sm">Rules automatically classify your transactions by matching description and memo patterns.</p>
      </div>
    </td></tr></tbody>`;
  }

  const rowsHtml = rules
    .map((r) => {
      return `<tr class="border-b border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
        <td class="px-4 py-3 text-sm"><span class="font-medium text-zinc-900 dark:text-zinc-100">${escapeHtml(r.category)}</span></td>
        <td class="px-4 py-3 text-sm">${formatConditions(r.conditions)}</td>
        <td class="px-4 py-3 text-sm text-right tabular-nums text-zinc-700 dark:text-zinc-300">${r.priority}</td>
        <td class="px-4 py-3 text-sm text-right">
          <button class="btn btn-ghost btn-ghost-danger"
            hx-delete="/api/categories/rules/${r.id}"
            hx-target="#category-rules-tbody"
            hx-swap="outerHTML"
            hx-confirm="Delete this rule?"
            title="Delete rule">
            &#10005; Delete
          </button>
        </td>
      </tr>`;
    })
    .join("\n");

  return `<tbody id="category-rules-tbody">${rowsHtml}</tbody>`;
}

function formatConditions(cond: unknown): string {
  const conditions = cond as Record<string, unknown>;
  const parts: string[] = [];

  const desc = conditions.description as { pattern?: string; mode?: string } | undefined;
  if (desc?.pattern) {
    const modeSymbol = desc.mode === "exact" ? "=" : desc.mode === "regex" ? "~r" : "~";
    parts.push(`description ${modeSymbol} "${escapeHtml(desc.pattern)}"`);
  }

  const memo = conditions.memo as { pattern?: string; mode?: string } | undefined;
  if (memo?.pattern) {
    const modeSymbol = memo.mode === "exact" ? "=" : memo.mode === "regex" ? "~r" : "~";
    parts.push(`memo ${modeSymbol} "${escapeHtml(memo.pattern)}"`);
  }

  const account = conditions.account as string | undefined;
  if (account) {
    parts.push(`account = "${escapeHtml(account)}"`);
  }

  const amount = conditions.amount as { min?: number; max?: number; exact?: number } | undefined;
  if (amount) {
    if (amount.exact != null) parts.push(`amount = ${amount.exact}`);
    else {
      if (amount.min != null) parts.push(`amount >= ${amount.min}`);
      if (amount.max != null) parts.push(`amount <= ${amount.max}`);
    }
  }

  const direction = conditions.direction as string | undefined;
  if (direction) {
    parts.push(`direction = ${direction}`);
  }

  if (parts.length === 0) return `<span class="text-zinc-500 dark:text-zinc-300 text-sm">No conditions</span>`;

  return parts.map((p) => `<span class="inline-block px-2 py-0.5 text-xs font-mono bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded">${p}</span>`).join(" ");
}
