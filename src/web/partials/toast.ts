// Toast notification partial — injected via hx-swap-oob into #toast-container

export function toastSuccess(message: string): string {
  return `<div id="toast-container" hx-swap-oob="afterbegin:#toast-container"><div class="toast toast-success">${message}</div></div>`;
}

export function toastError(message: string): string {
  return `<div id="toast-container" hx-swap-oob="afterbegin:#toast-container"><div class="toast toast-error">${message}<button class="toast-close" title="Dismiss">&times;</button></div></div>`;
}
