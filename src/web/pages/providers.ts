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
    <div class="page-header">
      <hgroup>
        <h2>Providers</h2>
        <p>${providers.length} provider${providers.length !== 1 ? "s" : ""} configured</p>
      </hgroup>
      <button id="fetch-btn" onclick="startFetch(false)" ${isEmpty ? "disabled" : ""}>
        Fetch All
      </button>
    </div>

    <article id="fetch-status-card" style="display:none;">
      <progress id="fetch-progress"></progress>
      <small id="fetch-message" class="text-muted"></small>
    </article>

    <div id="fetch-results" style="display:none;"></div>

    <article style="padding:0;">
      ${providerCards(cards)}
    </article>

    <div id="auth-form-container"></div>

    <article class="provider-add-card" id="add-provider-card">
      <details${isEmpty ? " open" : ""}>
        <summary role="button" class="outline" style="border:none;box-shadow:none;background:transparent;">+ Add Provider</summary>
        <div style="padding:0 1.25rem 1.25rem;">
          <form hx-post="/api/providers" hx-target="#provider-cards" hx-swap="outerHTML" hx-on::after-request="if(event.detail.successful) this.reset()">
            <div class="grid">
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
            <div id="dynamic-fields"></div>
          </form>
        </div>
      </details>
    </article>

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
            var html = '<article><table role="grid" class="card-table"><thead><tr><th>Provider</th><th>Status</th><th>Added</th><th>Updated</th></tr></thead><tbody>';
            for (var i = 0; i < evt.results.length; i++) {
              var r = evt.results[i];
              var statusBadge = r.success
                ? '<span class="badge badge-success">&#10003; OK</span>'
                : '<span class="badge badge-danger">&#10007; Failed</span>';
              html += '<tr><td>' + r.alias + '</td><td>' + statusBadge + (r.error ? ' <small class="text-muted">' + r.error + '</small>' : '') + '</td><td>' + r.added + '</td><td>' + r.updated + '</td></tr>';
              if (!r.success) hasFailures = true;
            }
            html += '</tbody></table>';

            if (hasFailures) {
              html += '<button onclick="startFetch(true)" class="outline secondary" style="margin-top:0.5rem;">Retry failed with visible browser (for OTP/2FA)</button>';
            }
            html += '</article>';

            results.innerHTML = html;
            results.style.display = 'block';

            // Refresh provider cards to update last synced times and tx counts
            htmx.ajax('GET', '/api/providers/cards', {target: '#provider-cards', swap: 'outerHTML'});
          } else if (evt.type === 'error') {
            statusCard.style.display = 'none';
            btn.disabled = false;
            btn.textContent = 'Fetch All';
            btn.removeAttribute('aria-busy');
            results.innerHTML = '<article><p><span class="badge badge-danger">Error</span> ' + evt.message + '</p><button onclick="startFetch(true)" class="outline secondary">Retry with visible browser</button></article>';
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
