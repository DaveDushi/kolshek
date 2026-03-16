// Provider card list partial -- returned on add/delete for HTMX swap.

import { escapeHtml } from "../layout.js";
import { formatRelativeTime } from "./utils.js";
import type { Provider } from "../../types/index.js";


export interface ProviderCardData {
  provider: Provider;
  hasAuth: boolean;
  txCount: number;
}

export function providerCards(cards: ProviderCardData[]): string {
  if (cards.length === 0) {
    return `<div id="provider-cards">
      <div class="flex flex-col items-center gap-3 py-14 text-center">
        <div class="flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 mb-1">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-zinc-400 dark:text-zinc-500"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
        </div>
        <p class="text-zinc-800 dark:text-zinc-200 font-semibold">No providers yet</p>
        <p class="text-zinc-500 dark:text-zinc-300 text-sm max-w-xs">Connect your first bank or credit card below to start tracking transactions automatically.</p>
      </div>
    </div>`;
  }

  const html = cards
    .map((c, i) => {
      const p = c.provider;
      const typeLabel = p.type === "bank" ? "Bank" : "Credit Card";
      const typeIcon = p.type === "bank" ? "&#127974;" : "&#128179;";
      const syncDisplay = p.lastSyncedAt ? formatRelativeTime(p.lastSyncedAt) : "Never synced";
      const authBadge = c.hasAuth
        ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">&#10003; Connected</span>`
        : `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">&#9888; Setup needed</span>`;
      const isLast = i === cards.length - 1;
      const borderClass = isLast ? "" : " border-b border-zinc-200 dark:border-zinc-700";

      return `<div class="flex items-center justify-between px-5 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors${borderClass}" id="provider-card-${p.id}">
        <div class="min-w-0">
          <div class="font-semibold text-zinc-900 dark:text-white text-sm">${typeIcon} ${escapeHtml(p.displayName)}</div>
          <div class="flex flex-wrap items-center gap-1.5 text-zinc-500 dark:text-zinc-300 text-xs mt-1">
            <span>${escapeHtml(p.alias)}</span>
            <span class="text-zinc-300 dark:text-zinc-500">&middot;</span>
            <span>${typeLabel}</span>
            <span class="text-zinc-300 dark:text-zinc-500">&middot;</span>
            <span>${c.txCount} transaction${c.txCount !== 1 ? "s" : ""}</span>
            <span class="text-zinc-300 dark:text-zinc-500">&middot;</span>
            <span>${syncDisplay}</span>
          </div>
          <div class="mt-1.5">${authBadge}</div>
        </div>
        <div class="flex items-center gap-1 shrink-0 ml-4">
          <button class="btn btn-ghost"
            hx-get="/api/providers/${p.id}/auth-form"
            hx-target="#auth-form-container"
            hx-swap="innerHTML"
            title="Update credentials">
            &#9998; Edit
          </button>
          <button class="btn btn-ghost btn-ghost-danger"
            hx-delete="/api/providers/${p.id}"
            hx-target="#provider-cards"
            hx-swap="outerHTML"
            hx-confirm="Remove ${escapeHtml(p.displayName)} and its credentials?"
            title="Remove provider">
            &#10005; Remove
          </button>
        </div>
      </div>`;
    })
    .join("\n");

  return `<div id="provider-cards">${html}</div>`;
}

