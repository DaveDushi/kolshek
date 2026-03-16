// Providers page — card layout with per-provider fetch, auth, and add-card.

import { layout } from "../layout.js";
import { providerCards, type ProviderCardData } from "../partials/provider-cards.js";
import { listProviders } from "../../db/repositories/providers.js";
import { countTransactions } from "../../db/repositories/transactions.js";
import { hasCredentials } from "../../security/keychain.js";
import { getProvidersByType } from "../../types/provider.js";

export async function providersPage(): Promise<string> {
  const providers = listProviders();
  const cards: ProviderCardData[] = await Promise.all(
    providers.map(async (p) => ({
      provider: p,
      hasAuth: await hasCredentials(p.alias),
      txCount: countTransactions({ providerId: p.id }),
    })),
  );

  const banks = getProvidersByType("bank");
  const creditCards = getProvidersByType("credit_card");
  const isEmpty = providers.length === 0;

  const body = `
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-3">
        <div class="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
        </div>
        <div>
          <h2 class="text-xl font-bold text-zinc-900 dark:text-white">Providers</h2>
          <p class="text-zinc-500 dark:text-zinc-300 text-sm mt-0.5">${providers.length} provider${providers.length !== 1 ? "s" : ""} configured</p>
        </div>
      </div>
      <button id="fetch-btn" class="btn btn-primary" onclick="startFetch(false)" ${isEmpty ? "disabled" : ""}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
        Fetch All
      </button>
    </div>

    <div id="fetch-status-card" class="card p-4 mb-4" style="display:none;">
      <div class="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2 overflow-hidden">
        <div id="fetch-progress" class="bg-indigo-600 h-2 rounded-full transition-all" style="width:100%; animation: pulse 1.5s ease-in-out infinite;"></div>
      </div>
      <p id="fetch-message" class="text-zinc-500 dark:text-zinc-300 text-sm mt-2"></p>
    </div>

    <div id="fetch-results" style="display:none;"></div>

    <div class="card mb-4">
      ${providerCards(cards)}
    </div>

    <div id="auth-form-container"></div>

    <div class="card" id="add-provider-card">
      <details${isEmpty ? " open" : ""}>
        <summary class="flex items-center gap-2 px-5 py-3.5 cursor-pointer list-none [&::-webkit-details-marker]:hidden text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-colors select-none">
          <svg class="w-4 h-4 transition-transform [[open]>&]:rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Provider
        </summary>
        <div class="px-5 pb-5 border-t border-zinc-200 dark:border-zinc-700 pt-4">
          <form hx-post="/api/providers" hx-target="#provider-cards" hx-swap="outerHTML" hx-on::after-request="if(event.detail.successful) this.reset()">
            <div class="grid grid-cols-2 gap-4">
              <label>
                Type
                <select name="providerType" id="provider-type-select"
                  hx-on:change="updateProviderOptions()">
                  <option value="">Select type...</option>
                  <option value="bank">Bank</option>
                  <option value="credit_card">Credit Card</option>
                </select>
              </label>
              <label>
                Provider
                <select name="providerSelect" id="provider-select" disabled>
                  <option value="">Select provider...</option>
                </select>
              </label>
            </div>
            <div id="dynamic-fields" class="mt-4"></div>
          </form>
        </div>
      </details>
    </div>

    <script>
      var bankOptions = ${JSON.stringify(banks.map((b) => ({ value: b.companyId, label: b.displayName })))};
      var ccOptions = ${JSON.stringify(creditCards.map((c) => ({ value: c.companyId, label: c.displayName })))};

      function updateProviderOptions() {
        var typeSelect = document.getElementById('provider-type-select');
        var provSelect = document.getElementById('provider-select');
        var type = typeSelect.value;
        var options = type === 'bank' ? bankOptions : type === 'credit_card' ? ccOptions : [];

        provSelect.innerHTML = '<option value="">Select provider...</option>' +
          options.map(function(o) { return '<option value="' + o.value + '">' + o.label + '</option>'; }).join('');
        provSelect.disabled = !type;
        document.getElementById('dynamic-fields').innerHTML = '';
      }

      document.getElementById('provider-select').addEventListener('change', function() {
        var companyId = this.value;
        if (!companyId) {
          document.getElementById('dynamic-fields').innerHTML = '';
          return;
        }
        htmx.ajax('GET', '/api/providers/fields/' + companyId, {target: '#dynamic-fields', swap: 'innerHTML'});
      });

      function startFetch(visible) {
        var btn = document.getElementById('fetch-btn');
        var statusCard = document.getElementById('fetch-status-card');
        var msg = document.getElementById('fetch-message');
        var results = document.getElementById('fetch-results');

        btn.disabled = true;
        btn.textContent = 'Fetching...';
        btn.setAttribute('aria-busy', 'true');
        statusCard.style.display = 'block';
        results.style.display = 'none';
        results.innerHTML = '';
        msg.textContent = 'Starting...';

        var reqBody = new URLSearchParams();
        if (visible) reqBody.set('visible', '1');

        fetch('/api/fetch', { method: 'POST', body: reqBody })
          .then(function(response) {
            var reader = response.body.getReader();
            var decoder = new TextDecoder();
            var buffer = '';

            function read() {
              reader.read().then(function(result) {
                if (result.done) return;
                buffer += decoder.decode(result.value, { stream: true });
                var lines = buffer.split('\\n');
                buffer = lines.pop();
                for (var i = 0; i < lines.length; i++) {
                  if (lines[i].startsWith('data: ')) {
                    handleEvent(JSON.parse(lines[i].slice(6)));
                  }
                }
                read();
              });
            }
            read();
          })
          .catch(function(err) {
            msg.textContent = 'Connection error: ' + err.message;
            btn.disabled = false;
            btn.textContent = 'Fetch All';
            btn.removeAttribute('aria-busy');
          });

        function handleEvent(evt) {
          if (evt.type === 'start') {
            msg.textContent = 'Connecting to ' + evt.providers.length + ' provider(s)...' + (evt.visible ? ' (visible browser)' : '');
          } else if (evt.type === 'progress') {
            msg.textContent = evt.alias + ': ' + formatStage(evt.stage);
          } else if (evt.type === 'done') {
            statusCard.style.display = 'none';
            btn.disabled = false;
            btn.textContent = 'Fetch All';
            btn.removeAttribute('aria-busy');

            var hasFailures = false;
            var html = '<div class="card"><div class="overflow-x-auto"><table class="w-full text-left"><thead><tr class="border-b border-zinc-200 dark:border-zinc-700"><th class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50">Provider</th><th class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50">Status</th><th class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50">Added</th><th class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50">Updated</th></tr></thead><tbody>';
            for (var i = 0; i < evt.results.length; i++) {
              var r = evt.results[i];
              var statusBadge = r.success
                ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">&#10003; OK</span>'
                : '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300">&#10007; Failed</span>';
              html += '<tr class="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"><td class="px-4 py-3 text-sm">' + r.alias + '</td><td class="px-4 py-3 text-sm">' + statusBadge + (r.error ? ' <span class="text-zinc-500 dark:text-zinc-300 text-sm ml-1">' + r.error + '</span>' : '') + '</td><td class="px-4 py-3 text-sm">' + r.added + '</td><td class="px-4 py-3 text-sm">' + r.updated + '</td></tr>';
              if (!r.success) hasFailures = true;
            }
            html += '</tbody></table></div>';

            if (hasFailures) {
              html += '<div class="px-4 py-3 border-t border-zinc-200 dark:border-zinc-700"><button onclick="startFetch(true)" class="btn btn-outline">Retry failed with visible browser (for OTP/2FA)</button></div>';
            }
            html += '</div>';

            results.innerHTML = html;
            results.style.display = 'block';

            // Refresh provider cards to update last synced times and tx counts
            htmx.ajax('GET', '/api/providers/cards', {target: '#provider-cards', swap: 'outerHTML'});
          } else if (evt.type === 'error') {
            statusCard.style.display = 'none';
            btn.disabled = false;
            btn.textContent = 'Fetch All';
            btn.removeAttribute('aria-busy');
            results.innerHTML = '<div class="card p-4"><p class="mb-3"><span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300">Error</span> ' + evt.message + '</p><button onclick="startFetch(true)" class="btn btn-outline">Retry with visible browser</button></div>';
            results.style.display = 'block';
          }
        }

        function formatStage(stage) {
          var stages = {
            loading_credentials: 'Loading credentials...',
            scraping: 'Scraping transactions...',
            processing: 'Processing data...',
            logging_in: 'Logging in...',
            waiting_for_page: 'Waiting for page...',
            fetching_data: 'Fetching data...',
          };
          return stages[stage] || stage;
        }
      }
    </script>`;

  return layout("Providers", "/providers", body);
}
