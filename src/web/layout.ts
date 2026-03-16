// HTML layout shell for the settings dashboard.
// Pico CSS (classless) + HTMX loaded from CDN. Zero build step.
// Custom teal/warm-gray design system with dark mode support.

import { listProviders } from "../db/repositories/providers.js";
import { listCategories } from "../db/repositories/categories.js";
import { listUntranslatedGrouped } from "../db/repositories/translations.js";

interface NavCounts {
  providers?: number;
  categories?: number;
  untranslated?: number;
}

export function layout(title: string, currentPath: string, body: string, counts?: NavCounts): string {
  // Auto-query counts if not provided
  const c = counts ?? {
    providers: listProviders().length,
    categories: listCategories().length,
    untranslated: listUntranslatedGrouped().length,
  };

  const navBadge = (n: number | undefined) =>
    n != null && n > 0 ? ` <span class="nav-count">${n}</span>` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} — KolShek</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css">
  <script src="https://unpkg.com/htmx.org@2.0.4"></script>
  <style>
    /* ── Typography ── */
    :root, [data-theme="light"], [data-theme="dark"] {
      --pico-font-family: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
      --pico-font-size: 15px;
      --pico-line-height: 1.5;
    }

    /* ── Light theme (default) ── */
    :root {
      --pico-primary: #0d9488;
      --pico-primary-background: #0d9488;
      --pico-primary-hover: #0f766e;
      --pico-primary-hover-background: #0f766e;
      --pico-primary-focus: rgba(13, 148, 136, 0.125);
      --pico-primary-inverse: #fff;
      --pico-background-color: #f8fafc;
      --pico-card-background-color: #ffffff;
      --pico-card-sectioning-background-color: #f8fafc;
      --pico-muted-color: #64748b;
      --pico-muted-border-color: #e2e8f0;
      --pico-form-element-border-color: #cbd5e1;
      --pico-form-element-focus-color: var(--pico-primary);
      --accent-gold: #d97706;
      --surface: #ffffff;
      --surface-hover: #f1f5f9;
      --card-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
      --card-shadow-hover: 0 4px 12px rgba(0,0,0,0.08);
      --badge-success-bg: #dcfce7;
      --badge-success-fg: #166534;
      --badge-danger-bg: #fef2f2;
      --badge-danger-fg: #991b1b;
      --badge-warning-bg: #fffbeb;
      --badge-warning-fg: #92400e;
      --condition-bg: #f0fdfa;
      --condition-fg: #115e59;
      --condition-border: #99f6e4;
      --toast-shadow: 0 8px 24px rgba(0,0,0,0.12);
      --empty-icon-color: #94a3b8;
      --nav-bg: #ffffff;
      --nav-border: #e2e8f0;
      --nav-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }

    /* ── Dark theme ── */
    [data-theme="dark"] {
      --pico-primary: #2dd4bf;
      --pico-primary-background: #0d9488;
      --pico-primary-hover: #14b8a6;
      --pico-primary-hover-background: #14b8a6;
      --pico-primary-focus: rgba(45, 212, 191, 0.15);
      --pico-primary-inverse: #042f2e;
      --pico-background-color: #0c0f1a;
      --pico-card-background-color: #141726;
      --pico-card-sectioning-background-color: #111425;
      --pico-color: #e2e8f0;
      --pico-h1-color: #f1f5f9;
      --pico-h2-color: #f1f5f9;
      --pico-h3-color: #e2e8f0;
      --pico-muted-color: #94a3b8;
      --pico-muted-border-color: #1e293b;
      --pico-form-element-background-color: #0f172a;
      --pico-form-element-border-color: #334155;
      --pico-form-element-focus-color: var(--pico-primary);
      --surface: #141726;
      --surface-hover: #1e2235;
      --card-shadow: 0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2);
      --card-shadow-hover: 0 4px 12px rgba(0,0,0,0.4);
      --badge-success-bg: rgba(34, 197, 94, 0.15);
      --badge-success-fg: #86efac;
      --badge-danger-bg: rgba(239, 68, 68, 0.15);
      --badge-danger-fg: #fca5a5;
      --badge-warning-bg: rgba(245, 158, 11, 0.15);
      --badge-warning-fg: #fcd34d;
      --condition-bg: rgba(45, 212, 191, 0.1);
      --condition-fg: #5eead4;
      --condition-border: rgba(45, 212, 191, 0.2);
      --toast-shadow: 0 8px 24px rgba(0,0,0,0.4);
      --empty-icon-color: #475569;
      --nav-bg: #111425;
      --nav-border: #1e293b;
      --nav-shadow: 0 1px 3px rgba(0,0,0,0.3);
    }

    /* ── Global transitions ── */
    html { transition: background-color 0.2s ease; }
    body { transition: color 0.2s ease; }

    /* ── Nav ── */
    header.container {
      background: var(--nav-bg);
      border-bottom: 1px solid var(--nav-border);
      box-shadow: var(--nav-shadow);
      margin-bottom: 2rem;
      max-width: 100%;
      padding: 0;
    }
    header.container nav {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 1.5rem;
    }
    header.container nav > ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    header.container nav > ul:last-child {
      gap: 0.75rem;
    }
    nav a {
      text-decoration: none;
      color: var(--pico-muted-color);
      font-weight: 500;
      font-size: 0.9rem;
      padding: 0.75rem 0;
      transition: color 0.15s;
    }
    nav a:hover { color: var(--pico-color, #1e293b); }
    nav a[aria-current="page"] {
      color: var(--pico-primary);
      border-bottom: 2px solid var(--pico-primary);
      padding-bottom: calc(0.75rem - 2px);
      text-decoration: none;
    }
    nav strong {
      font-size: 1.05rem;
      letter-spacing: -0.02em;
    }
    .nav-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 1.2rem;
      height: 1.2rem;
      padding: 0 0.3rem;
      margin-left: 0.3rem;
      font-size: 0.65rem;
      font-weight: 700;
      border-radius: 9999px;
      background: var(--pico-primary);
      color: var(--pico-primary-inverse);
      vertical-align: middle;
    }
    #theme-toggle {
      background: none;
      border: 1px solid var(--pico-muted-border-color);
      border-radius: 0.375rem;
      padding: 0.35rem 0.55rem;
      cursor: pointer;
      font-size: 1.05rem;
      color: var(--pico-muted-color);
      transition: color 0.2s, border-color 0.2s, background 0.2s;
      line-height: 1;
      margin: 0;
    }
    #theme-toggle:hover {
      color: var(--pico-primary);
      border-color: var(--pico-primary);
      background: var(--pico-primary-focus);
    }

    /* ── Main container ── */
    main.container { max-width: 1200px; }

    /* ── Page header ── */
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .page-header hgroup { margin-bottom: 0; }
    .page-header hgroup h2 { margin-bottom: 0.1rem; font-size: 1.6rem; letter-spacing: -0.02em; }
    .page-header hgroup p { margin-bottom: 0; }

    /* ── Cards / Articles ── */
    article {
      border: 1px solid var(--pico-muted-border-color);
      border-radius: 0.75rem;
      background: var(--surface);
      box-shadow: var(--card-shadow);
      transition: box-shadow 0.2s;
      overflow: hidden;
      margin-bottom: 1.25rem;
      padding: 0;
    }
    article > table,
    article > details,
    article > form,
    article > div,
    article > header,
    article > p,
    article > fieldset {
      margin: 0;
    }
    // Override Pico's default article padding — we want tighter cards
    article { padding: 1.25rem; }
    article header {
      border-bottom: 1px solid var(--pico-muted-border-color);
      margin: -1.25rem -1.25rem 1rem -1.25rem;
      padding: 0.85rem 1.25rem;
      background: var(--pico-card-sectioning-background-color);
    }

    /* ── Badges (pills) ── */
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.2rem 0.6rem;
      border-radius: 9999px;
      font-size: 0.72rem;
      font-weight: 600;
      white-space: nowrap;
      line-height: 1.4;
      letter-spacing: 0.01em;
    }
    .badge-success {
      background: var(--badge-success-bg);
      color: var(--badge-success-fg);
    }
    .badge-danger {
      background: var(--badge-danger-bg);
      color: var(--badge-danger-fg);
    }
    .badge-warning {
      background: var(--badge-warning-bg);
      color: var(--badge-warning-fg);
    }

    /* ── Condition tags ── */
    .condition-tag {
      display: inline-block;
      padding: 0.15rem 0.5rem;
      margin: 0.1rem 0.15rem;
      font-size: 0.75rem;
      font-family: ui-monospace, "Cascadia Code", "Fira Code", monospace;
      background: var(--condition-bg);
      color: var(--condition-fg);
      border: 1px solid var(--condition-border);
      border-radius: 0.3rem;
      white-space: nowrap;
    }

    /* ── Empty states ── */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.4rem;
      padding: 3rem 1rem;
      text-align: center;
    }
    .empty-state .empty-icon {
      font-size: 2.5rem;
      color: var(--empty-icon-color);
      line-height: 1;
      margin-bottom: 0.25rem;
    }
    .empty-state p {
      margin: 0;
      max-width: 26rem;
    }
    .empty-state .text-muted {
      font-size: 0.85rem;
    }

    /* ── Tables ── */
    table { margin-bottom: 0; }
    .card-table { width: 100%; }
    .card-table thead th {
      font-size: 0.78rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--pico-muted-color);
      padding: 0.65rem 1rem;
      border-bottom: 1px solid var(--pico-muted-border-color);
    }
    .card-table tbody td {
      padding: 0.7rem 1rem;
      font-size: 0.9rem;
      vertical-align: middle;
    }
    .card-table tbody tr {
      transition: background 0.12s;
    }
    .card-table tbody tr:hover {
      background: var(--surface-hover);
    }
    .card-table tbody tr:not(:last-child) td {
      border-bottom: 1px solid var(--pico-muted-border-color);
    }
    .card-table tbody tr:last-child td {
      border-bottom: none;
    }

    /* ── Responsive: table → cards at 576px ── */
    @media (max-width: 576px) {
      .page-header {
        flex-direction: column;
        align-items: stretch;
      }
      .page-header button,
      .page-header a[role="button"] {
        width: 100%;
      }
      .card-table thead { display: none; }
      .card-table tbody tr {
        display: block;
        margin-bottom: 0.75rem;
        padding: 0.75rem;
        border: 1px solid var(--pico-muted-border-color);
        border-radius: 0.5rem;
        background: var(--surface);
      }
      .card-table tbody td {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.3rem 0;
        border: none !important;
      }
      .card-table tbody td::before {
        content: attr(data-label);
        font-weight: 600;
        margin-right: 1rem;
        flex-shrink: 0;
        font-size: 0.8rem;
        color: var(--pico-muted-color);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .card-table tbody td:empty { display: none; }
      .card-table tbody td[data-label=""] { justify-content: flex-end; }
      .card-table tbody td[data-label=""]::before { display: none; }
    }

    /* ── Actions ── */
    .actions {
      display: flex;
      gap: 0.35rem;
      justify-content: flex-end;
    }
    .actions button {
      padding: 0.3rem 0.55rem;
      font-size: 0.82rem;
      margin: 0;
      border-radius: 0.375rem;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }

    /* ── Toasts ── */
    #toast-container {
      position: fixed;
      top: 1rem;
      right: 1rem;
      z-index: 999;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-width: 22rem;
    }
    .toast {
      position: relative;
      padding: 0.75rem 1.25rem;
      border-radius: 0.625rem;
      color: #fff;
      box-shadow: var(--toast-shadow);
      animation: toastSlideIn 0.25s ease-out;
      line-height: 1.4;
      font-size: 0.88rem;
      backdrop-filter: blur(8px);
    }
    .toast-success { background: rgba(22, 163, 74, 0.95); }
    .toast-error {
      background: rgba(220, 38, 38, 0.95);
      padding-right: 2.5rem;
    }
    .toast-close {
      position: absolute;
      top: 0.4rem;
      right: 0.5rem;
      background: none;
      border: none;
      color: rgba(255,255,255,0.7);
      font-size: 1.1rem;
      cursor: pointer;
      padding: 0.15rem 0.35rem;
      line-height: 1;
      margin: 0;
      border-radius: 0.25rem;
      transition: color 0.15s;
    }
    .toast-close:hover { color: #fff; }
    .toast.removing {
      animation: toastFadeOut 0.3s ease-out forwards;
    }
    @keyframes toastSlideIn {
      from { opacity: 0; transform: translateX(1rem); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes toastFadeOut {
      from { opacity: 1; transform: translateY(0); }
      to   { opacity: 0; transform: translateY(-0.5rem); }
    }

    /* ── Row highlight (newly added) ── */
    @keyframes highlightRow {
      from { background: var(--pico-primary-focus); }
      to   { background: transparent; }
    }
    .highlight-new { animation: highlightRow 1.5s ease-out; }

    /* ── Misc ── */
    .text-muted { color: var(--pico-muted-color); font-size: 0.875rem; }
    details[open] summary { margin-bottom: 1rem; }
    details summary[role="button"].outline {
      width: 100%;
      text-align: center;
      border-radius: 0.5rem;
    }
    fieldset {
      border: 1px solid var(--pico-muted-border-color);
      border-radius: 0.5rem;
      padding: 1rem;
    }
    h2 { letter-spacing: -0.02em; }
    h3, h4 { letter-spacing: -0.01em; }

    /* ── Button polish ── */
    button, [role="button"] {
      border-radius: 0.5rem;
      font-weight: 500;
      letter-spacing: -0.01em;
      transition: all 0.15s ease;
    }
    input, select, textarea {
      border-radius: 0.5rem !important;
    }

    /* ── Provider cards ── */
    .provider-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--pico-muted-border-color);
    }
    .provider-card:last-child { border-bottom: none; }
    .provider-card-info { flex: 1; min-width: 0; }
    .provider-card-name { font-weight: 600; font-size: 0.95rem; }
    .provider-card-meta { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; font-size: 0.82rem; color: var(--pico-muted-color); margin-top: 0.2rem; }
    .provider-card-meta .separator { opacity: 0.4; }
    .provider-card-actions { display: flex; gap: 0.35rem; flex-shrink: 0; }
    .provider-card-actions button { padding: 0.3rem 0.6rem; font-size: 0.8rem; margin: 0; }
    .provider-add-card {
      border: 2px dashed var(--pico-muted-border-color);
      background: transparent;
      box-shadow: none;
      cursor: pointer;
      text-align: center;
      transition: border-color 0.15s, background 0.15s;
    }
    .provider-add-card:hover {
      border-color: var(--pico-primary);
      background: var(--pico-primary-focus);
    }

    /* ── Categories layout ── */
    .categories-layout {
      display: grid;
      grid-template-columns: minmax(220px, 280px) 1fr;
      gap: 1.5rem;
      align-items: start;
    }
    .category-sidebar { position: sticky; top: 1rem; }
    .category-list { list-style: none; padding: 0; margin: 0; }
    .category-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem 0.75rem;
      border-radius: 0.5rem;
      border-left: 3px solid transparent;
      cursor: pointer;
      transition: background 0.12s, border-color 0.12s;
      font-size: 0.9rem;
      text-decoration: none;
      color: inherit;
    }
    .category-item:hover { background: var(--surface-hover); }
    .category-item.active {
      background: var(--pico-primary-focus);
      border-left-color: var(--pico-primary);
      font-weight: 600;
    }
    .category-item.uncategorized { border-left-color: var(--accent-gold); }
    .category-item .cat-count {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--pico-muted-color);
      min-width: 1.5rem;
      text-align: right;
    }

    /* ── Transaction rows ── */
    .tx-row {
      display: grid;
      grid-template-columns: 4.5rem 1fr auto auto;
      gap: 0.75rem;
      align-items: center;
      padding: 0.6rem 1rem;
      border-bottom: 1px solid var(--pico-muted-border-color);
      transition: background 0.12s;
    }
    .tx-row:last-child { border-bottom: none; }
    .tx-row:hover { background: var(--surface-hover); }
    .tx-date { font-size: 0.82rem; color: var(--pico-muted-color); white-space: nowrap; }
    .tx-desc { min-width: 0; overflow: hidden; }
    .tx-desc-he { direction: rtl; unicode-bidi: isolate; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.9rem; }
    .tx-desc-en { display: block; font-size: 0.78rem; color: var(--pico-muted-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tx-amount { font-size: 0.9rem; font-weight: 500; white-space: nowrap; text-align: right; font-variant-numeric: tabular-nums; }
    .tx-amount-expense { color: var(--badge-danger-fg); }
    .tx-amount-income { color: var(--badge-success-fg); }
    .inline-select { margin: 0; padding: 0.25rem 0.5rem; font-size: 0.82rem; height: auto; min-width: 8rem; }
    .tx-row--moved {
      background: var(--badge-success-bg);
      opacity: 0.7;
      pointer-events: none;
      animation: txFadeOut 0.6s 0.4s ease-out forwards;
    }
    @keyframes txFadeOut {
      to { opacity: 0; height: 0; padding: 0; border: none; overflow: hidden; }
    }

    /* ── Category action panel (inline confirm) ── */
    .category-action-panel {
      padding: 1rem 1.25rem;
      background: var(--pico-primary-focus);
      border-bottom: 1px solid var(--pico-muted-border-color);
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
      font-size: 0.9rem;
    }
    .category-action-panel select { margin: 0; min-width: 10rem; }
    .category-action-panel button { margin: 0; }

    /* ── Translation rows ── */
    .translate-row {
      display: grid;
      grid-template-columns: minmax(120px, 1fr) auto minmax(200px, 1.2fr) auto;
      gap: 0.75rem;
      align-items: center;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--pico-muted-border-color);
    }
    .translate-row:last-child { border-bottom: none; }
    .translate-source { direction: rtl; unicode-bidi: isolate; text-align: right; font-size: 0.9rem; }
    .translate-source-meta { font-size: 0.78rem; color: var(--pico-muted-color); direction: ltr; }
    .translate-arrow { color: var(--pico-muted-color); font-size: 1.1rem; text-align: center; }
    .translate-input-group { display: flex; gap: 0.5rem; align-items: center; }
    .translate-input-group input[type="text"] { margin: 0; font-size: 0.88rem; }
    .translate-input-group label { font-size: 0.78rem; white-space: nowrap; display: flex; align-items: center; gap: 0.25rem; margin: 0; }
    .translate-input-group label input[type="checkbox"] { margin: 0; width: auto; }
    .translate-row-success {
      background: var(--badge-success-bg);
      color: var(--badge-success-fg);
      font-size: 0.88rem;
      animation: translateFade 2s ease-out forwards;
    }
    @keyframes translateFade {
      0%, 70% { opacity: 1; max-height: 4rem; padding: 0.75rem 1rem; }
      100% { opacity: 0; max-height: 0; padding: 0; overflow: hidden; border: none; }
    }

    /* ── Mobile: categories layout ── */
    @media (max-width: 768px) {
      .categories-layout { grid-template-columns: 1fr; }
      .category-sidebar { position: sticky; top: 0; z-index: 10; background: var(--pico-background-color); padding: 0.5rem 0; border-bottom: 1px solid var(--pico-muted-border-color); }
      .category-list { display: flex; overflow-x: auto; gap: 0.35rem; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
      .category-item { flex-shrink: 0; border-radius: 9999px; border: 1px solid var(--pico-muted-border-color); font-size: 0.82rem; white-space: nowrap; border-left: none; padding: 0.35rem 0.75rem; }
      .category-item.active { border-color: var(--pico-primary); }
      .category-item.uncategorized { border-color: var(--accent-gold); }
      .tx-row { grid-template-columns: 1fr; gap: 0.25rem; }
      .tx-date { font-size: 0.75rem; }
      .inline-select { width: 100%; }
      .translate-row { grid-template-columns: 1fr; }
      .translate-arrow { display: none; }
      .provider-card { flex-direction: column; align-items: stretch; gap: 0.75rem; }
      .provider-card-actions { justify-content: flex-end; }
    }

    /* ── Reduced motion ── */
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
      }
    }
  </style>
</head>
<body>
  <header class="container">
    <nav>
      <ul>
        <li><strong>&#9670; KolShek</strong></li>
      </ul>
      <ul>
        <li><a href="/providers"${currentPath === "/providers" ? ' aria-current="page"' : ""}>Providers${navBadge(c.providers)}</a></li>
        <li><a href="/categories"${currentPath === "/categories" ? ' aria-current="page"' : ""}>Categories${navBadge(c.categories)}</a></li>
        <li><a href="/translations"${currentPath === "/translations" ? ' aria-current="page"' : ""}>Translations${navBadge(c.untranslated)}</a></li>
        <li>
          <button id="theme-toggle" onclick="toggleTheme()" title="Toggle dark mode">
            <span id="theme-icon"></span>
          </button>
        </li>
      </ul>
    </nav>
  </header>
  <main class="container">
    ${body}
  </main>
  <div id="toast-container" hx-swap-oob="true"></div>
  <script>
    // ── Dark mode ──
    (function() {
      var stored = localStorage.getItem('kolshek-theme');
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      var theme = stored || (prefersDark ? 'dark' : 'light');
      document.documentElement.setAttribute('data-theme', theme);
      updateThemeIcon(theme);
    })();

    function toggleTheme() {
      var current = document.documentElement.getAttribute('data-theme') || 'light';
      var next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('kolshek-theme', next);
      updateThemeIcon(next);
    }

    function updateThemeIcon(theme) {
      var icon = document.getElementById('theme-icon');
      if (icon) icon.textContent = theme === 'dark' ? '\\u2600' : '\\u263E';
    }

    // ── Toast auto-dismiss ──
    var toastObserver = new MutationObserver(function() {
      document.querySelectorAll('.toast').forEach(function(t) {
        if (t.dataset.timer) return;
        t.dataset.timer = '1';
        var isError = t.classList.contains('toast-error');
        var delay = isError ? 10000 : 4000;

        var closeBtn = t.querySelector('.toast-close');
        if (closeBtn) {
          closeBtn.addEventListener('click', function() {
            t.classList.add('removing');
            setTimeout(function() { t.remove(); }, 300);
          });
        }

        setTimeout(function() {
          if (t.parentNode) {
            t.classList.add('removing');
            setTimeout(function() { t.remove(); }, 300);
          }
        }, delay);
      });
    });
    toastObserver.observe(document.getElementById('toast-container'), { childList: true, subtree: true });
  </script>
</body>
</html>`;
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
