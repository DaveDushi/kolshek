// Translations page — untranslated-first grouped layout + translation rules + already translated.

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
    <!-- Untranslated Transactions (primary) -->
    <article>
      <header style="display:flex;justify-content:space-between;align-items:center;">
        <strong>Untranslated <span class="text-muted" style="font-weight:400;">(${untranslated.length} merchant name${untranslated.length !== 1 ? "s" : ""})</span></strong>
        <form hx-post="/api/translations/apply" hx-target="#toast-container" hx-swap="afterbegin"
          hx-on::after-request="if(event.detail.successful) htmx.ajax('GET','/api/translations/untranslated','#untranslated-list')"
          style="margin:0;">
          <button type="submit" class="outline" hx-disabled-elt="this" style="margin:0;padding:0.3rem 0.75rem;font-size:0.85rem;white-space:nowrap;">Apply All Rules</button>
        </form>
      </header>
      ${untranslatedList()}
    </article>

    <!-- Translation Rules (collapsible) -->
    <article>
      <details${rules.length === 0 ? " open" : ""}>
        <summary style="padding:0.85rem 1.25rem;cursor:pointer;font-weight:600;font-size:0.95rem;">
          Translation Rules <span class="text-muted" style="font-weight:400;">(${rules.length})</span>
        </summary>
        <div style="padding:0 1.25rem 1rem;">
          <table role="grid" class="card-table">
            <thead>
              <tr>
                <th>English Name</th>
                <th>Match Pattern (Hebrew)</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            ${translationRulesTableBody(rules)}
          </table>

          <details style="margin-top:1rem;">
            <summary role="button" class="outline" style="text-align:center;">+ Add Rule</summary>
            <form hx-post="/api/translations/rules" hx-target="#translation-rules-tbody" hx-swap="outerHTML"
              hx-on::after-request="if(event.detail.successful) this.reset()">
              <div class="grid">
                <label>
                  English Name
                  <input type="text" name="englishName" required placeholder="e.g. Shufersal">
                </label>
                <label>
                  Match Pattern (Hebrew)
                  <input type="text" name="matchPattern" required placeholder="e.g. &#1513;&#1493;&#1508;&#1512;&#1505;&#1500;" dir="rtl">
                </label>
              </div>
              <button type="submit" hx-disabled-elt="this">Add Rule</button>
            </form>
          </details>
        </div>
      </details>
    </article>

    <!-- Already Translated (collapsible) -->
    <article>
      <details${translated.length > 0 && untranslated.length === 0 ? " open" : ""}>
        <summary style="padding:0.85rem 1.25rem;cursor:pointer;font-weight:600;font-size:0.95rem;">
          Translated <span class="text-muted" style="font-weight:400;">(${translated.length} merchant name${translated.length !== 1 ? "s" : ""})</span>
        </summary>
        <div style="padding:0 1.25rem 1rem;">
          <input type="search" id="translate-filter" placeholder="Filter by name..."
            style="margin:0 0 0.75rem;padding:0.4rem 0.75rem;font-size:0.85rem;"
            oninput="filterTranslated(this.value)">
          ${translatedList()}
        </div>
      </details>
    </article>

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
