// Provider card list partial — returned on add/delete for HTMX swap.

import { escapeHtml } from "../layout.js";
import type { Provider } from "../../types/index.js";


export interface ProviderCardData {
  provider: Provider;
  hasAuth: boolean;
  txCount: number;
}

export function providerCards(cards: ProviderCardData[]): string {
  if (cards.length === 0) {
    return `<div id="provider-cards">
      <div class="empty-state">
        <span class="empty-icon">&#127974;</span>
        <p>No providers configured yet</p>
        <p class="text-muted">Connect a bank or credit card account to start tracking your finances.</p>
      </div>
    </div>`;
  }

  const html = cards
    .map((c) => {
      const p = c.provider;
      const typeLabel = p.type === "bank" ? "Bank" : "Credit Card";
      const typeIcon = p.type === "bank" ? "&#127974;" : "&#128179;";
      const syncDisplay = p.lastSyncedAt ? formatRelativeTime(p.lastSyncedAt) : "Never synced";
      const authBadge = c.hasAuth
        ? `<span class="badge badge-success">&#10003; Connected</span>`
        : `<span class="badge badge-warning">&#9888; Setup needed</span>`;

      return `<div class="provider-card" id="provider-card-${p.id}">
        <div class="provider-card-info">
          <div class="provider-card-name">${typeIcon} ${escapeHtml(p.displayName)}</div>
          <div class="provider-card-meta">
            <span>${escapeHtml(p.alias)}</span>
            <span class="separator">&middot;</span>
            <span>${typeLabel}</span>
            <span class="separator">&middot;</span>
            <span>${c.txCount} transaction${c.txCount !== 1 ? "s" : ""}</span>
            <span class="separator">&middot;</span>
            <span>${syncDisplay}</span>
          </div>
          <div style="margin-top:0.3rem">${authBadge}</div>
        </div>
        <div class="provider-card-actions">
          <button hx-get="/api/providers/${p.id}/auth-form" hx-target="#auth-form-container" hx-swap="innerHTML" class="outline secondary" title="Update credentials">&#9998;</button>
          <button hx-delete="/api/providers/${p.id}" hx-target="#provider-cards" hx-swap="outerHTML" hx-confirm="Remove ${escapeHtml(p.displayName)} and its credentials?" class="outline secondary" title="Remove provider">&#10005;</button>
        </div>
      </div>`;
    })
    .join("\n");

  return `<div id="provider-cards">${html}</div>`;
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-IL");
}
