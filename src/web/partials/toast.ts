// Toast notification partial -- injected via hx-swap-oob into #toast-container

import { escapeHtml } from "../layout.js";

export function toastSuccess(message: string): string {
  return `<div id="toast-container" hx-swap-oob="afterbegin:#toast-container"><div class="toast px-4 py-3 rounded-lg text-sm font-medium text-white shadow-lg backdrop-blur-sm bg-emerald-600/95">${escapeHtml(message)}</div></div>`;
}

export function toastError(message: string): string {
  return `<div id="toast-container" hx-swap-oob="afterbegin:#toast-container"><div class="toast toast-error px-4 py-3 pr-9 rounded-lg text-sm font-medium text-white shadow-lg backdrop-blur-sm bg-rose-600/95 relative">${escapeHtml(message)}<button class="toast-close absolute top-1.5 right-2 bg-transparent border-none text-white/70 hover:text-white text-base cursor-pointer p-0.5 leading-none rounded" title="Dismiss">&times;</button></div></div>`;
}
