// Settings dashboard HTTP server — Bun.serve() with URL routing.
// HTMX partials for inline updates. Tailwind CSS built via @tailwindcss/cli.

import { resolve } from "node:path";
import { providersPage } from "./pages/providers.js";
import { categoriesPage } from "./pages/categories.js";
import { translationsPage } from "./pages/translations.js";
import {
  providerLoginFields,
  providerAuthFields,
} from "./partials/provider-fields.js";
import {
  providerCards,
  type ProviderCardData,
} from "./partials/provider-cards.js";
import { categoryRulesTableBody } from "./partials/category-rules-table.js";
import { categorySummaryTable } from "./partials/category-summary-table.js";
import { categorySidebar } from "./partials/category-sidebar.js";
import { categoryTxPanel } from "./partials/category-tx-panel.js";
import { translationRulesTableBody } from "./partials/translation-rules-table.js";
import { untranslatedList } from "./partials/untranslated-list.js";
import { translatedList } from "./partials/translated-list.js";
import { toastSuccess, toastError } from "./partials/toast.js";
import { escapeHtml } from "./layout.js";
import {
  listProviders,
  createProvider,
  deleteProvider,
  getProvider,
} from "../db/repositories/providers.js";
import {
  hasCredentials,
  storeCredentials,
  deleteCredentials,
} from "../security/keychain.js";
import {
  PROVIDERS,
  isValidCompanyId,
  type CompanyId,
} from "../types/provider.js";
import {
  countTransactions,
  updateTransactionCategory,
} from "../db/repositories/transactions.js";
import {
  listCategoryRules,
  addCategoryRule,
  removeCategoryRule,
  applyCategoryRules,
  createCategory,
  deleteCategory,
  renameCategory,
  categoryExists,
  listAllCategories,
} from "../db/repositories/categories.js";
import {
  listTranslationRules,
  addTranslationRule,
  removeTranslationRule,
  applyTranslationRules,
  translateByDescription,
  updateTranslationByDescription,
} from "../db/repositories/translations.js";
import { syncProviders } from "../core/sync-engine.js";
import type { RuleConditions, MatchMode } from "../types/category-rule.js";

// Track active fetch so we don't allow concurrent syncs
let activeFetch: { promise: Promise<void>; events: string[] } | null = null;

// Resolve paths to static assets (import.meta.dir is Bun-native, handles Windows)
const cssPath = resolve(import.meta.dir, "dist/styles.css");
const logoPath = resolve(import.meta.dir, "../../assets/logo.png");

export function startDashboard(port: number) {
  const server = Bun.serve({
    port,
    hostname: "localhost",
    async fetch(req) {
      const url = new URL(req.url);
      const path = url.pathname;
      const method = req.method;

      // CSRF protection: block cross-origin mutations
      if (method !== "GET" && method !== "HEAD") {
        const origin = req.headers.get("origin") ?? "";
        if (
          origin &&
          !origin.includes(`localhost:${port}`) &&
          !origin.includes(`127.0.0.1:${port}`)
        ) {
          return new Response("Forbidden: cross-origin request", {
            status: 403,
          });
        }
      }

      try {
        // --- Static assets ---
        if (method === "GET" && path === "/styles.css") {
          const file = Bun.file(cssPath);
          if (await file.exists()) {
            return new Response(file, {
              headers: {
                "Content-Type": "text/css; charset=utf-8",
                "Cache-Control": "public, max-age=3600",
              },
            });
          }
          return new Response("/* CSS not built */", {
            status: 404,
            headers: { "Content-Type": "text/css" },
          });
        }
        if (method === "GET" && path === "/logo.png") {
          const file = Bun.file(logoPath);
          if (await file.exists()) {
            return new Response(file, {
              headers: {
                "Content-Type": "image/png",
                "Cache-Control": "public, max-age=86400",
              },
            });
          }
          return new Response("Not found", { status: 404 });
        }

        // --- Pages ---
        if (method === "GET" && (path === "/" || path === "")) {
          return Response.redirect("/providers", 302);
        }
        if (method === "GET" && path === "/providers") {
          return html(await providersPage());
        }
        if (method === "GET" && path === "/categories") {
          const cat = url.searchParams.get("cat") ?? undefined;
          return html(categoriesPage(cat));
        }
        if (method === "GET" && path === "/translations") {
          return html(translationsPage());
        }

        // --- Provider API ---

        // GET /api/providers/cards — provider cards partial (for HTMX refresh)
        if (method === "GET" && path === "/api/providers/cards") {
          return html(await providerCardsHtml());
        }

        // GET /api/providers/fields/:companyId — dynamic login fields
        const fieldsMatch = path.match(
          /^\/api\/providers\/fields\/([a-zA-Z]+)$/,
        );
        if (method === "GET" && fieldsMatch) {
          return html(providerLoginFields(fieldsMatch[1]));
        }

        // GET /api/providers/:id/auth-form — credential update form
        const authFormMatch = path.match(
          /^\/api\/providers\/(\d+)\/auth-form$/,
        );
        if (method === "GET" && authFormMatch) {
          const provider = getProvider(Number(authFormMatch[1]));
          if (!provider) return html(toastError("Provider not found"), 404);
          return html(providerAuthFields(provider.companyId, provider.id));
        }

        // POST /api/providers — add provider
        if (method === "POST" && path === "/api/providers") {
          const form = await parseForm(req);
          const companyId = form.get("companyId") ?? "";
          if (!isValidCompanyId(companyId)) {
            return html(toastError("Invalid provider type."), 400);
          }

          const info = PROVIDERS[companyId];
          const alias = form.get("alias") || companyId;

          if (!/^[a-zA-Z0-9_-]+$/.test(alias)) {
            return html(
              toastError(
                "Alias must contain only letters, numbers, dashes, and underscores.",
              ),
              400,
            );
          }

          // Extract credentials from cred_* fields
          const credentials: Record<string, string> = {};
          for (const field of info.loginFields) {
            const val = form.get(`cred_${field}`) ?? "";
            if (field !== "otpLongTermToken" && !val) {
              return html(toastError(`Missing required field: ${field}`), 400);
            }
            if (val) credentials[field] = val;
          }

          try {
            await storeCredentials(alias, credentials);
            // Zero credentials
            for (const key of Object.keys(credentials)) credentials[key] = "";

            createProvider(companyId, info.displayName, info.type, alias);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return html(
              (await providerCardsHtml()) + toastError(`Failed: ${msg}`),
            );
          }

          return html(
            (await providerCardsHtml()) + toastSuccess("Provider added."),
          );
        }

        // POST /api/providers/:id/auth — update credentials
        const authMatch = path.match(/^\/api\/providers\/(\d+)\/auth$/);
        if (method === "POST" && authMatch) {
          const provider = getProvider(Number(authMatch[1]));
          if (!provider) return html(toastError("Provider not found."), 404);

          const info = PROVIDERS[provider.companyId as CompanyId];
          if (!info) return html(toastError("Unknown provider type."), 400);

          const form = await parseForm(req);
          const credentials: Record<string, string> = {};
          for (const field of info.loginFields) {
            const val = form.get(`cred_${field}`) ?? "";
            if (field !== "otpLongTermToken" && !val) {
              return html(toastError(`Missing required field: ${field}`), 400);
            }
            if (val) credentials[field] = val;
          }

          try {
            await storeCredentials(provider.alias, credentials);
            for (const key of Object.keys(credentials)) credentials[key] = "";
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return html(toastError(`Failed: ${msg}`));
          }

          // Clear the auth form and show success toast
          return html(toastSuccess("Credentials updated."));
        }

        // DELETE /api/providers/:id — remove provider
        const deleteProviderMatch = path.match(/^\/api\/providers\/(\d+)$/);
        if (method === "DELETE" && deleteProviderMatch) {
          const provider = getProvider(Number(deleteProviderMatch[1]));
          if (!provider) return html(toastError("Provider not found."), 404);

          try {
            await deleteCredentials(provider.alias).catch(() => {});
            deleteProvider(provider.id);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return html(
              (await providerCardsHtml()) + toastError(`Failed: ${msg}`),
            );
          }

          return html(
            (await providerCardsHtml()) +
              toastSuccess(`Removed ${provider.displayName}.`),
          );
        }

        // --- Category Entity API ---

        // POST /api/categories — create empty category
        if (method === "POST" && path === "/api/categories") {
          const form = await parseForm(req);
          const name = form.get("name")?.trim() ?? "";
          if (!name) return html(toastError("Category name is required."), 400);

          const created = createCategory(name);
          if (!created) {
            return html(
              categorySummaryTable() + toastError("Category already exists."),
            );
          }
          return html(
            categorySummaryTable() +
              toastSuccess(`Category "${name}" created.`),
          );
        }

        // GET /api/categories/summary-table — category summary tbody (for cancel/refresh)
        if (method === "GET" && path === "/api/categories/summary-table") {
          return html(categorySummaryTable());
        }

        // GET /api/categories/sidebar — sidebar partial
        if (method === "GET" && path === "/api/categories/sidebar") {
          const active = url.searchParams.get("active") ?? undefined;
          return html(categorySidebar(active));
        }

        // GET /api/categories/transactions — tx panel for category
        if (method === "GET" && path === "/api/categories/transactions") {
          const cat = url.searchParams.get("cat") ?? "Uncategorized";
          return html(categoryTxPanel(cat));
        }

        // GET /api/categories/:name/edit — inline rename form
        const catEditMatch = path.match(/^\/api\/categories\/([^/]+)\/edit$/);
        if (method === "GET" && catEditMatch) {
          const name = decodeURIComponent(catEditMatch[1]);
          return html(inlineRenameForm(name));
        }

        // POST /api/categories/:name/rename — execute rename
        const catRenameMatch = path.match(
          /^\/api\/categories\/([^/]+)\/rename$/,
        );
        if (method === "POST" && catRenameMatch) {
          const oldName = decodeURIComponent(catRenameMatch[1]);
          const form = await parseForm(req);
          const newName = form.get("newName")?.trim() ?? "";
          if (!newName) return html(toastError("New name is required."), 400);
          if (newName === oldName)
            return html(categorySummaryTable() + toastSuccess("No change."));

          // If destination exists, this is a merge
          const exists = categoryExists(newName);
          const result = renameCategory(oldName, newName);
          const verb = exists ? "merged into" : "renamed to";
          return html(
            categorySummaryTable() +
              toastSuccess(
                `"${oldName}" ${verb} "${newName}" (${result.transactionsUpdated} txs, ${result.rulesUpdated} rules).`,
              ),
          );
        }

        // GET /api/categories/:name/delete-confirm — delete confirmation panel
        const catDeleteConfirmMatch = path.match(
          /^\/api\/categories\/([^/]+)\/delete-confirm$/,
        );
        if (method === "GET" && catDeleteConfirmMatch) {
          const name = decodeURIComponent(catDeleteConfirmMatch[1]);
          return html(deleteConfirmPanel(name));
        }

        // POST /api/categories/:name/delete — execute delete
        const catDeleteMatch = path.match(
          /^\/api\/categories\/([^/]+)\/delete$/,
        );
        if (method === "POST" && catDeleteMatch) {
          const name = decodeURIComponent(catDeleteMatch[1]);
          const form = await parseForm(req);
          const moveTo = form.get("moveTo")?.trim() ?? "Uncategorized";

          if (name === "Uncategorized") {
            return html(toastError("Cannot delete Uncategorized."), 400);
          }

          const result = deleteCategory(name, moveTo);
          // Return updated summary table + cleared action panel + toast
          return html(
            categorySummaryTable() +
              `<div id="category-action-panel" hx-swap-oob="innerHTML:#category-action-panel"></div>` +
              toastSuccess(
                `Deleted "${name}". Moved ${result.transactionsUpdated} txs to "${moveTo}".`,
              ),
          );
        }

        // --- Category Rules API ---

        // POST /api/categories/rules — add rule
        if (method === "POST" && path === "/api/categories/rules") {
          const form = await parseForm(req);
          const category = form.get("category")?.trim() ?? "";
          const priority = Number(form.get("priority") ?? "10");
          const descriptionPattern =
            form.get("descriptionPattern")?.trim() ?? "";
          const descriptionMode = form.get("descriptionMode") ?? "substring";
          const memoPattern = form.get("memoPattern")?.trim() ?? "";
          const direction = form.get("direction")?.trim() ?? "";

          if (!category)
            return html(toastError("Category name is required."), 400);
          if (!descriptionPattern && !memoPattern) {
            return html(
              toastError(
                "At least one condition (description or memo) is required.",
              ),
              400,
            );
          }

          const validModes = new Set<MatchMode>([
            "substring",
            "exact",
            "regex",
          ]);
          const mode: MatchMode = validModes.has(descriptionMode as MatchMode)
            ? (descriptionMode as MatchMode)
            : "substring";

          const conditions: RuleConditions = {};
          if (descriptionPattern) {
            conditions.description = { pattern: descriptionPattern, mode };
          }
          if (memoPattern) {
            conditions.memo = { pattern: memoPattern, mode: "substring" };
          }
          if (direction === "debit" || direction === "credit") {
            conditions.direction = direction;
          }

          try {
            addCategoryRule(category, conditions, priority);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return html(
              categoryRulesTableBody(listCategoryRules()) +
                toastError(`Failed: ${msg}`),
            );
          }

          return html(
            categoryRulesTableBody(listCategoryRules()) +
              toastSuccess("Rule added."),
          );
        }

        // DELETE /api/categories/rules/:id
        const deleteCatRuleMatch = path.match(
          /^\/api\/categories\/rules\/(\d+)$/,
        );
        if (method === "DELETE" && deleteCatRuleMatch) {
          const id = Number(deleteCatRuleMatch[1]);
          const removed = removeCategoryRule(id);
          if (!removed)
            return html(
              categoryRulesTableBody(listCategoryRules()) +
                toastError("Rule not found."),
            );
          return html(
            categoryRulesTableBody(listCategoryRules()) +
              toastSuccess("Rule deleted."),
          );
        }

        // POST /api/categories/apply
        if (method === "POST" && path === "/api/categories/apply") {
          const form = await parseForm(req);
          const scope = (form.get("scope") ?? "uncategorized") as
            | "uncategorized"
            | "all";
          const result = applyCategoryRules({ scope });
          return html(
            categorySummaryTable() +
              toastSuccess(
                `Applied rules: ${result.applied} transaction${result.applied !== 1 ? "s" : ""} categorized.`,
              ),
          );
        }

        // --- Transaction API ---

        // PATCH /api/transactions/:id/category — move single tx to different category
        const txCategoryMatch = path.match(
          /^\/api\/transactions\/(\d+)\/category$/,
        );
        if (method === "PATCH" && txCategoryMatch) {
          const txId = Number(txCategoryMatch[1]);
          const form = await parseForm(req);
          const newCategory = form.get("category")?.trim() ?? "";
          const fromCategory = form.get("from")?.trim() ?? "";

          if (!newCategory)
            return html(toastError("Category is required."), 400);

          const updated = updateTransactionCategory(txId, newCategory);
          if (!updated) return html(toastError("Transaction not found."), 404);

          // Return moved-state row that fades out, plus OOB sidebar update + toast
          const movedRow = `<div class="tx-row tx-row--moved" id="tx-row-${txId}">
            <div class="col-span-full text-center py-2 text-indigo-600 dark:text-indigo-400 text-sm font-medium">
              Moved to ${escapeHtml(newCategory)}
            </div>
          </div>`;

          const oobSidebar = `<div id="category-sidebar" hx-swap-oob="outerHTML:#category-sidebar">${categorySidebar(fromCategory || undefined)}</div>`;
          const toast = toastSuccess(`Moved to "${newCategory}".`);

          return html(movedRow + oobSidebar + toast);
        }

        // --- Translation Rules API ---

        // POST /api/translations/rules
        if (method === "POST" && path === "/api/translations/rules") {
          const form = await parseForm(req);
          const englishName = form.get("englishName")?.trim() ?? "";
          const matchPattern = form.get("matchPattern")?.trim() ?? "";

          if (!englishName || !matchPattern) {
            return html(
              toastError("Both English name and match pattern are required."),
              400,
            );
          }

          try {
            addTranslationRule(englishName, matchPattern);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return html(
              translationRulesTableBody(listTranslationRules()) +
                toastError(`Failed: ${msg}`),
            );
          }

          return html(
            translationRulesTableBody(listTranslationRules()) +
              toastSuccess("Rule added."),
          );
        }

        // DELETE /api/translations/rules/:id
        const deleteTransRuleMatch = path.match(
          /^\/api\/translations\/rules\/(\d+)$/,
        );
        if (method === "DELETE" && deleteTransRuleMatch) {
          const id = Number(deleteTransRuleMatch[1]);
          const removed = removeTranslationRule(id);
          if (!removed)
            return html(
              translationRulesTableBody(listTranslationRules()) +
                toastError("Rule not found."),
            );
          return html(
            translationRulesTableBody(listTranslationRules()) +
              toastSuccess("Rule deleted."),
          );
        }

        // POST /api/translations/apply
        if (method === "POST" && path === "/api/translations/apply") {
          const result = applyTranslationRules();
          return html(
            toastSuccess(
              `Applied translations: ${result.applied} transaction${result.applied !== 1 ? "s" : ""} updated.`,
            ),
          );
        }

        // GET /api/translations/untranslated — untranslated list partial
        if (method === "GET" && path === "/api/translations/untranslated") {
          return html(untranslatedList());
        }

        // POST /api/translations/translate — translate a Hebrew description + optionally create rule
        if (method === "POST" && path === "/api/translations/translate") {
          const form = await parseForm(req);
          const hebrew = form.get("hebrew")?.trim() ?? "";
          const english = form.get("english")?.trim() ?? "";
          const shouldCreateRule = form.get("createRule") === "1";

          if (!hebrew || !english) {
            return html(
              toastError("Hebrew description and English name are required."),
              400,
            );
          }

          const count = translateByDescription(hebrew, english);

          if (shouldCreateRule) {
            try {
              addTranslationRule(english, hebrew);
            } catch {
              // Rule might already exist — that's fine
            }
          }

          // Return a success row that fades out
          return html(`<div class="translate-row translate-row-success flex items-center justify-center p-3 mx-3 my-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 text-sm font-medium">
            Translated ${count} transaction${count !== 1 ? "s" : ""} as "${escapeHtml(english)}"
          </div>`);
        }

        // POST /api/translations/update — edit an existing translation
        if (method === "POST" && path === "/api/translations/update") {
          const form = await parseForm(req);
          const hebrew = form.get("hebrew")?.trim() ?? "";
          const english = form.get("english")?.trim() ?? "";

          if (!hebrew || !english) {
            return html(
              toastError("Hebrew description and English name are required."),
              400,
            );
          }

          const count = updateTranslationByDescription(hebrew, english);

          // Return refreshed translated list + toast
          return html(
            translatedList() +
              toastSuccess(
                `Updated ${count} transaction${count !== 1 ? "s" : ""} to "${english}".`,
              ),
          );
        }

        // GET /api/translations/translated — translated list partial
        if (method === "GET" && path === "/api/translations/translated") {
          return html(translatedList());
        }

        // --- Fetch / Sync API ---

        // POST /api/fetch — start a fetch (headless). Returns SSE stream.
        // POST /api/fetch?visible=1 — retry with visible browser (for OTP/2FA)
        if (method === "POST" && path === "/api/fetch") {
          if (activeFetch) {
            return html(toastError("A fetch is already in progress."), 409);
          }

          const form = await parseForm(req);
          const visible = form.get("visible") === "1";

          return startFetchSSE(visible);
        }

        // GET /api/fetch/events — SSE stream for fetch progress
        if (method === "GET" && path === "/api/fetch/events") {
          return fetchEventsSSE();
        }

        // --- 404 ---
        return new Response("Not found", { status: 404 });
      } catch (err) {
        console.error("Dashboard error:", err);
        const msg = err instanceof Error ? err.message : String(err);
        return html(toastError(`Server error: ${msg}`), 500);
      }
    },
  });

  return server;
}

// --- Helpers ---

function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    },
  });
}

async function parseForm(req: Request): Promise<Map<string, string>> {
  const contentType = req.headers.get("content-type") ?? "";
  const result = new Map<string, string>();

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await req.text();
    const params = new URLSearchParams(text);
    for (const [key, value] of params) {
      result.set(key, value);
    }
  } else if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    for (const [key, value] of formData) {
      if (typeof value === "string") result.set(key, value);
    }
  }

  return result;
}

// Inline rename form -- replaces category name cell
function inlineRenameForm(name: string): string {
  const encoded = encodeURIComponent(name);
  return `<form class="flex items-center gap-1.5" hx-post="/api/categories/${encoded}/rename"
    hx-target="#category-summary-tbody" hx-swap="outerHTML">
    <input type="text" name="newName" value="${escapeHtml(name)}" required
      class="min-w-32">
    <button type="submit" class="btn btn-outline btn-sm">OK</button>
    <button type="button" class="btn btn-outline btn-sm"
      hx-get="/api/categories/summary-table" hx-target="#category-summary-tbody" hx-swap="outerHTML">Cancel</button>
  </form>`;
}

// Delete confirmation panel -- appears in #category-action-panel
function deleteConfirmPanel(name: string): string {
  const encoded = encodeURIComponent(name);
  const allCats = listAllCategories().filter((c) => c !== name);
  const options = allCats
    .map(
      (c) =>
        `<option value="${escapeHtml(c)}"${c === "Uncategorized" ? " selected" : ""}>${escapeHtml(c)}</option>`,
    )
    .join("");

  const txCount = countTransactions({
    category: name === "Uncategorized" ? null : name,
  });

  return `<div class="p-3 bg-indigo-50 dark:bg-indigo-900/20 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2 flex-wrap text-sm">
    <form class="flex items-center gap-2 flex-wrap" hx-post="/api/categories/${encoded}/delete"
      hx-target="#category-summary-tbody" hx-swap="outerHTML">
      <strong class="text-sm">Delete &ldquo;${escapeHtml(name)}&rdquo;</strong>
      <span class="text-zinc-500 dark:text-zinc-300 text-sm">(${txCount} tx${txCount !== 1 ? "s" : ""})</span>
      <span class="text-sm">Move to:</span>
      <select name="moveTo" class="m-0 text-sm py-1 px-2 h-auto w-auto">
        ${options}
      </select>
      <button type="submit" class="btn btn-outline btn-sm">Confirm</button>
      <button type="button" class="btn btn-outline btn-sm"
        onclick="document.getElementById('category-action-panel').innerHTML=''">Cancel</button>
    </form>
  </div>`;
}

async function providerCardsHtml(): Promise<string> {
  const providers = listProviders();
  const authStatuses = await Promise.all(
    providers.map((p) => hasCredentials(p.alias)),
  );
  const cards: ProviderCardData[] = providers.map((p, i) => ({
    provider: p,
    hasAuth: authStatuses[i],
    txCount: countTransactions({ providerId: p.id }),
  }));
  return providerCards(cards);
}

function startFetchSSE(visible: boolean): Response {
  const events: string[] = [];
  const listeners: Set<(event: string) => void> = new Set();

  function pushEvent(data: string) {
    events.push(data);
    for (const listener of listeners) listener(data);
  }

  // Start fetch in background
  const providers = listProviders();
  if (providers.length === 0) {
    return html(toastError("No providers configured."), 400);
  }

  pushEvent(
    JSON.stringify({
      type: "start",
      providers: providers.map((p) => p.alias),
      visible,
    }),
  );

  const fetchPromise = syncProviders(providers, {
    visible,
    onProgress: (alias, stage) => {
      pushEvent(JSON.stringify({ type: "progress", alias, stage }));
    },
  })
    .then((result) => {
      const summary = result.results.map((r) => ({
        alias: r.alias,
        success: r.success,
        added: r.transactionsAdded,
        updated: r.transactionsUpdated,
        error: r.error,
      }));
      pushEvent(
        JSON.stringify({
          type: "done",
          success: !result.hasErrors,
          totalAdded: result.totalAdded,
          totalUpdated: result.totalUpdated,
          results: summary,
        }),
      );
    })
    .catch((err) => {
      pushEvent(
        JSON.stringify({
          type: "error",
          message: err instanceof Error ? err.message : String(err),
        }),
      );
    })
    .finally(() => {
      activeFetch = null;
    });

  activeFetch = { promise: fetchPromise, events };

  // Return an SSE response that streams events.
  // Register listener BEFORE replaying to avoid missing events pushed concurrently.
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let closed = false;

      const listener = (data: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          const parsed = JSON.parse(data);
          if (parsed.type === "done" || parsed.type === "error") {
            closed = true;
            listeners.delete(listener);
            controller.close();
          }
        } catch {
          // ignore encoding errors on closed stream
        }
      };
      listeners.add(listener);

      // Replay events that already happened (listener catches any concurrent additions)
      for (const evt of events) {
        if (closed) break;
        controller.enqueue(encoder.encode(`data: ${evt}\n\n`));
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

function fetchEventsSSE(): Response {
  if (!activeFetch) {
    // No active fetch — send an immediate "idle" event
    const body = `data: ${JSON.stringify({ type: "idle" })}\n\n`;
    return new Response(body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  }

  // Replay stored events from the active fetch
  const events = activeFetch.events;
  const body = events.map((e) => `data: ${e}\n\n`).join("");
  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}
