// Translations page -- untranslated-first grouped layout + translation rules + already translated.

import { layout } from "../layout.js";
import { untranslatedList } from "../partials/untranslated-list.js";
import { translatedList } from "../partials/translated-list.js";
import { translationRulesTableBody } from "../partials/translation-rules-table.js";
import { listTranslationRules, listUntranslatedGrouped, listTranslatedGrouped } from "../../db/repositories/translations.js";

export function translationsPage(): string {
  const untranslated = listUntranslatedGrouped();
  const translated = listTranslatedGrouped();
  const rules = listTranslationRules();

  const body = `
    <!-- Untranslated Transactions (primary -- action needed) -->
    <div class="card mb-6 ${untranslated.length > 0 ? "ring-1 ring-amber-200 dark:ring-amber-800/50" : ""}">
      <div class="card-header ${untranslated.length > 0 ? "!bg-amber-50/60 dark:!bg-amber-900/10 !border-b-amber-200/70 dark:!border-b-amber-800/40" : ""}">
        <div class="flex items-center gap-2.5">
          <div class="flex items-center justify-center w-7 h-7 rounded-lg ${untranslated.length > 0 ? "bg-amber-100 dark:bg-amber-900/30" : "bg-emerald-100 dark:bg-emerald-900/30"}">
            ${untranslated.length > 0
              ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-amber-600 dark:text-amber-400"><path d="M12 9v2m0 4h.01M5.07 19H18.93a2 2 0 0 0 1.73-3L13.73 4a2 2 0 0 0-3.46 0L3.34 16a2 2 0 0 0 1.73 3z"/></svg>`
              : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-600 dark:text-emerald-400"><polyline points="20 6 9 17 4 12"/></svg>`
            }
          </div>
          <span class="font-semibold text-sm text-zinc-900 dark:text-white">Untranslated</span>
          ${untranslated.length > 0
            ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">${untranslated.length} need${untranslated.length !== 1 ? "" : "s"} attention</span>`
            : `<span class="text-emerald-600 dark:text-emerald-400 text-xs font-medium">All done</span>`
          }
        </div>
        ${untranslated.length > 0 ? `<form hx-post="/api/translations/apply" hx-target="#toast-container" hx-swap="afterbegin"
          hx-on::after-request="if(event.detail.successful) htmx.ajax('GET','/api/translations/untranslated','#untranslated-list')"
          class="m-0">
          <button type="submit" class="btn btn-outline btn-sm" hx-disabled-elt="this">Apply All Rules</button>
        </form>` : ""}
      </div>
      ${untranslatedList()}
    </div>

    <!-- Translation Rules (collapsible) -->
    <div class="card mb-6">
      <details${rules.length === 0 ? " open" : ""}>
        <summary class="flex items-center justify-between px-5 py-3 cursor-pointer select-none hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors list-none [&::-webkit-details-marker]:hidden">
          <div class="flex items-center gap-2.5">
            <div class="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-900/20">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-indigo-600 dark:text-indigo-400"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </div>
            <span class="font-semibold text-sm text-zinc-900 dark:text-white">Translation Rules</span>
            <span class="inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 tabular-nums">${rules.length}</span>
          </div>
          <svg class="w-4 h-4 text-zinc-400 transition-transform [[open]>&]:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </summary>
        <div class="px-5 pb-4">
          <div class="overflow-x-auto">
            <table class="w-full text-left">
              <thead>
                <tr class="border-b border-zinc-200 dark:border-zinc-700">
                  <th class="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3">English Name</th>
                  <th class="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3">Match Pattern (Hebrew)</th>
                  <th class="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3">Created</th>
                  <th class="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3"></th>
                </tr>
              </thead>
              ${translationRulesTableBody(rules)}
            </table>
          </div>

          <details class="mt-4">
            <summary class="btn btn-outline text-center w-full cursor-pointer">+ Add Rule</summary>
            <form class="mt-3 space-y-3" hx-post="/api/translations/rules" hx-target="#translation-rules-tbody" hx-swap="outerHTML"
              hx-on::after-request="if(event.detail.successful) this.reset()">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label>
                  English Name
                  <input type="text" name="englishName" required placeholder="e.g. Shufersal">
                </label>
                <label>
                  Match Pattern (Hebrew)
                  <input type="text" name="matchPattern" required placeholder="e.g. &#1513;&#1493;&#1508;&#1512;&#1505;&#1500;" dir="rtl">
                </label>
              </div>
              <button type="submit" class="btn btn-primary" hx-disabled-elt="this">Add Rule</button>
            </form>
          </details>
        </div>
      </details>
    </div>

    <!-- Already Translated (collapsible) -->
    <div class="card">
      <details${translated.length > 0 && untranslated.length === 0 ? " open" : ""}>
        <summary class="flex items-center justify-between px-5 py-3 cursor-pointer select-none hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors list-none [&::-webkit-details-marker]:hidden">
          <div class="flex items-center gap-2.5">
            <div class="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-600 dark:text-emerald-400"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <span class="font-semibold text-sm text-zinc-900 dark:text-white">Translated</span>
            <span class="inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 tabular-nums">${translated.length}</span>
          </div>
          <svg class="w-4 h-4 text-zinc-400 transition-transform [[open]>&]:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </summary>
        <div class="px-4 py-3">
          <input type="search" id="translate-filter" placeholder="Filter by name..."
            class="mb-2 text-sm"
            oninput="filterTranslated(this.value)">
          ${translatedList()}
        </div>
      </details>
    </div>

    <script>
      function filterTranslated(query) {
        var q = query.toLowerCase();
        var rows = document.querySelectorAll('#translated-list .translate-row');
        for (var i = 0; i < rows.length; i++) {
          var text = rows[i].textContent.toLowerCase();
          rows[i].style.display = text.indexOf(q) !== -1 ? '' : 'none';
        }
      }
    </script>`;

  return layout("Translations", "/translations", body);
}
