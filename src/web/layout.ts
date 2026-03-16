// HTML layout shell for the settings dashboard.
// Tailwind CSS (built via @tailwindcss/cli) + HTMX.
// KolShek design system: indigo primary, zinc neutrals, Inter font.

import { listProviders } from "../db/repositories/providers.js";
import { listCategories } from "../db/repositories/categories.js";
import { listUntranslatedGrouped } from "../db/repositories/translations.js";

interface NavCounts {
  providers?: number;
  categories?: number;
  untranslated?: number;
}

// Inline SVG icons for the theme toggle (16x16, stroke-based)
const sunIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="theme-icon-sun"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;

const moonIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="theme-icon-moon"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;

export function layout(title: string, currentPath: string, body: string, counts?: NavCounts): string {
  // Auto-query counts if not provided
  const c = counts ?? {
    providers: listProviders().length,
    categories: listCategories().length,
    untranslated: listUntranslatedGrouped().length,
  };

  const navLink = (href: string, label: string, count?: number) => {
    const isActive = currentPath === href;
    const base = "nav-pill";
    const active = isActive ? "nav-pill--active" : "";
    const badge = count != null && count > 0
      ? ` <span class="nav-badge">${count}</span>`
      : "";
    return `<a href="${href}" class="${base} ${active}"${isActive ? ' aria-current="page"' : ""}>${label}${badge}</a>`;
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} — KolShek</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css">
  <script src="https://unpkg.com/htmx.org@2.0.4"></script>
</head>
<body class="ks-body">
  <header class="ks-header">
    <nav class="max-w-6xl mx-auto px-6 flex items-center justify-between h-14">
      <a href="/providers" class="ks-brand group">
        <span class="ks-brand-mark">&#8362;</span>
        <span class="ks-brand-text">KolShek</span>
      </a>
      <div class="flex items-center gap-1.5">
        ${navLink("/providers", "Providers", c.providers)}
        ${navLink("/categories", "Categories", c.categories)}
        ${navLink("/translations", "Translations", c.untranslated)}
        <button id="theme-toggle" onclick="toggleTheme()" title="Toggle dark mode"
          class="ks-theme-toggle" aria-label="Toggle dark mode">
          ${sunIcon}
          ${moonIcon}
        </button>
      </div>
    </nav>
  </header>
  <main class="max-w-6xl mx-auto px-6 py-8">
    ${body}
  </main>
  <div id="toast-container" class="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm" hx-swap-oob="true"></div>
  <script>
    // Dark mode — SVG icon swap via display toggling
    (function() {
      var stored = localStorage.getItem('kolshek-theme');
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      var theme = stored || (prefersDark ? 'dark' : 'light');
      if (theme === 'dark') document.documentElement.classList.add('dark');
      updateThemeIcon(theme);
    })();

    function toggleTheme() {
      var isDark = document.documentElement.classList.toggle('dark');
      var theme = isDark ? 'dark' : 'light';
      localStorage.setItem('kolshek-theme', theme);
      updateThemeIcon(theme);
    }

    function updateThemeIcon(theme) {
      var sun = document.querySelector('.theme-icon-sun');
      var moon = document.querySelector('.theme-icon-moon');
      if (!sun || !moon) return;
      // In dark mode, show the sun (switch-to-light). In light mode, show the moon.
      if (theme === 'dark') {
        sun.style.display = 'block';
        moon.style.display = 'none';
      } else {
        sun.style.display = 'none';
        moon.style.display = 'block';
      }
    }

    // Toast auto-dismiss
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
