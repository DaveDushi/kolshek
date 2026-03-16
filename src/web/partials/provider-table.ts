// Provider table body partial — returned on add/delete for HTMX swap.

import { escapeHtml } from "../layout.js";
import type { Provider } from "../../types/index.js";

export interface ProviderRow {
  provider: Provider;
  hasAuth: boolean;
}

export function providerTableBody(rows: ProviderRow[]): string {
  if (rows.length === 0) {
    return `<tbody id="provider-tbody"><tr><td colspan="6">
      <div class="empty-state">
        <span class="empty-icon">&#127974;</span>
        <p>No providers configured yet</p>
        <p class="text-muted">Connect a bank or credit card account to start tracking your finances.</p>
      </div>
    </td></tr></tbody>`;
  }

  const rowsHtml = rows
    .map((r) => {
      const p = r.provider;
      const syncDisplay = p.lastSyncedAt ? formatRelativeTime(p.lastSyncedAt) : "Never";
      const authBadge = r.hasAuth
        ? `<span class="badge badge-success">&#10003; Connected</span>`
        : `<span class="badge badge-danger">&#10007; Missing</span>`;
      const typeLabel = p.type === "bank" ? "Bank" : "Credit Card";

      return `<tr>
        <td data-label="Alias">${escapeHtml(p.alias)}</td>
        <td data-label="Name">${escapeHtml(p.displayName)}</td>
        <td data-label="Type">${typeLabel}</td>
        <td data-label="Last Synced">${syncDisplay}</td>
        <td data-label="Auth">${authBadge}</td>
        <td data-label="" class="actions">
          <button hx-get="/api/providers/${p.id}/auth-form" hx-target="#auth-form-container" hx-swap="innerHTML" class="outline secondary" title="Update credentials">&#9998;</button>
          <button hx-delete="/api/providers/${p.id}" hx-target="#provider-tbody" hx-swap="outerHTML" hx-confirm="Remove ${escapeHtml(p.displayName)} and its credentials?" class="outline secondary" title="Remove provider">&#10005;</button>
        </td>
      </tr>`;
    })
    .join("\n");

  return `<tbody id="provider-tbody">${rowsHtml}</tbody>`;
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
