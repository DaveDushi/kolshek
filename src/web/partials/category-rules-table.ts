// Category rules table body partial — returned on add/delete for HTMX swap.

import { escapeHtml } from "../layout.js";
import type { CategoryRule } from "../../types/index.js";

export function categoryRulesTableBody(rules: CategoryRule[]): string {
  if (rules.length === 0) {
    return `<tbody id="category-rules-tbody"><tr><td colspan="4">
      <div class="empty-state">
        <span class="empty-icon">&#128203;</span>
        <p>No rules defined yet</p>
        <p class="text-muted">Rules automatically classify your transactions by matching description and memo patterns.</p>
      </div>
    </td></tr></tbody>`;
  }

  const rowsHtml = rules
    .map((r) => {
      return `<tr>
        <td data-label="Category">${escapeHtml(r.category)}</td>
        <td data-label="Conditions">${formatConditions(r.conditions)}</td>
        <td data-label="Priority">${r.priority}</td>
        <td data-label="" class="actions">
          <button hx-delete="/api/categories/rules/${r.id}" hx-target="#category-rules-tbody" hx-swap="outerHTML" hx-confirm="Delete this rule?" class="outline secondary" title="Delete rule">&#10005;</button>
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

  if (parts.length === 0) return `<span class="text-muted">No conditions</span>`;

  return parts.map((p) => `<span class="condition-tag">${p}</span>`).join(" ");
}
