// Dashboard HTTP server — Bun.serve() with URL routing.
// JSON API v2 routes for the React SPA dashboard.
// Authentication: single-use token in URL → HttpOnly session cookie.

import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
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
  listTransactions,
  searchTransactions,
  updateTransactionCategory,
} from "../db/repositories/transactions.js";
import { getAccountsByProvider } from "../db/repositories/accounts.js";
import {
  listCategoryRules,
  addCategoryRule,
  removeCategoryRule,
  applyCategoryRules,
  createCategory,
  deleteCategory,
  renameCategory,
  listAllCategories,
  listCategories,
  setCategoryClassification,
  getClassificationMap,
} from "../db/repositories/categories.js";
import {
  DEFAULT_SPENDING_EXCLUDES,
  DEFAULT_INCOME_EXCLUDES,
  DEFAULT_REPORT_EXCLUDES,
  BUILTIN_CLASSIFICATIONS,
  isValidClassification,
} from "../types/classification.js";
import {
  listTranslationRules,
  addTranslationRule,
  removeTranslationRule,
  applyTranslationRules,
  translateByDescription,
  listUntranslatedGrouped,
  listTranslatedGrouped,
} from "../db/repositories/translations.js";
import {
  getMonthlyReport,
  getCategoryReport,
  getBalanceReport,
} from "../db/repositories/reports.js";
import { getSpendingReport } from "../db/repositories/spending.js";
import { getIncomeReport } from "../db/repositories/income.js";
import {
  getTotalTrends,
  getCategoryTrends,
  getFixedVariableTrends,
} from "../db/repositories/trends.js";
import {
  getCategoryByMonth,
  getLargeTransactions,
  getMerchantHistory,
  getMonthCashflow,
} from "../db/repositories/insights.js";
import {
  detectCategorySpikes,
  detectLargeTransactions,
  detectNewMerchants,
  detectRecurringChanges,
  detectTrendWarnings,
} from "../core/insights.js";
import { syncProviders } from "../core/sync-engine.js";
import type { RuleConditions } from "../types/category-rule.js";
import type { TransactionFilters } from "../types/transaction.js";

// Track active fetch so we don't allow concurrent syncs
let activeFetch: { promise: Promise<void>; events: string[] } | null = null;

// Resolve paths to static assets (import.meta.dir is Bun-native, handles Windows)
const logoPath = resolve(import.meta.dir, "../../assets/logo.png");
const faviconPath = resolve(import.meta.dir, "../../assets/favicon.png");
const appDistDir = resolve(import.meta.dir, "dist/app");

// MIME types for serving static SPA assets
const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function getMimeType(filePath: string): string {
  const ext = filePath.slice(filePath.lastIndexOf("."));
  return MIME_TYPES[ext] || "application/octet-stream";
}

// --- JSON API helpers ---

// Allowed origins for CORS (Vite dev on :5173, server on :3000)
function getAllowedOrigins(port: number): string[] {
  return [
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ];
}

function corsHeaders(origin: string | null, allowedOrigins: string[]): Record<string, string> {
  // Only reflect the origin if it's in our allowlist
  const allowed = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

// Security headers applied to all responses
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
};

// MAX_PAGINATION_LIMIT prevents dumping entire DB via ?limit=999999999
const MAX_PAGINATION_LIMIT = 500;

// Validate that a user-supplied regex isn't pathologically complex (ReDoS)
function isSafeRegex(pattern: string): boolean {
  // Reject patterns longer than 200 chars
  if (pattern.length > 200) return false;
  // Reject nested quantifiers like (a+)+ or (a*)*
  if (/(\+|\*|\{)\)?(\+|\*|\{)/.test(pattern)) return false;
  // Reject excessive alternation groups
  if ((pattern.match(/\|/g) || []).length > 20) return false;
  // Try constructing — reject invalid
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

// Sanitize error messages — strip file paths and internal details
function sanitizeError(msg: string): string {
  // Remove Windows/Unix file paths
  return msg.replace(/[A-Z]:\\[^\s:]+/gi, "[path]")
    .replace(/\/[^\s:]*\/[^\s:]*/g, "[path]")
    .replace(/at\s+.+\(.+\)/g, "")
    .trim();
}

// json() and jsonError() are created per-request inside startDashboard
// so they have access to the CORS headers computed from the request origin.
// These are factory functions that return response builders.
type JsonFn = (data: unknown, status?: number) => Response;
type JsonErrorFn = (code: string, message: string, status?: number) => Response;

function makeJsonFn(cors: Record<string, string>): JsonFn {
  return (data, status = 200) =>
    new Response(JSON.stringify({ success: true, data }), {
      status,
      headers: { "Content-Type": "application/json; charset=utf-8", ...SECURITY_HEADERS, ...cors },
    });
}

function makeJsonErrorFn(cors: Record<string, string>): JsonErrorFn {
  return (code, message, status = 400) =>
    new Response(JSON.stringify({ success: false, error: { code, message: sanitizeError(message) } }), {
      status,
      headers: { "Content-Type": "application/json; charset=utf-8", ...SECURITY_HEADERS, ...cors },
    });
}

async function parseJsonBody(req: Request): Promise<Record<string, unknown>> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// Parse ?exclude= and ?include= query params for classification filtering.
// Falls back to endpoint-specific defaults when neither is provided.
function parseClassificationParams(
  url: URL,
  defaultExclusions: readonly string[],
): readonly string[] {
  const excludeParam = url.searchParams.get("exclude");
  const includeParam = url.searchParams.get("include");

  if (excludeParam !== null) {
    if (excludeParam === "") return [];
    return excludeParam.split(",").map((s) => s.trim()).filter(Boolean);
  }

  if (includeParam !== null) {
    if (includeParam === "") return defaultExclusions;
    const included = new Set(includeParam.split(",").map((s) => s.trim()).filter(Boolean));
    return BUILTIN_CLASSIFICATIONS.filter((c) => !included.has(c));
  }

  return defaultExclusions;
}

export function startDashboard(port: number): { server: ReturnType<typeof Bun.serve>; token: string } {
  const allowedOrigins = getAllowedOrigins(port);

  // Generate a one-time session token — only the CLI user sees this in the terminal.
  // The token is exchanged for an HttpOnly cookie on first visit.
  const sessionToken = randomBytes(32).toString("hex");
  const cookieName = "kolshek_session";

  // Parse the session cookie from a Cookie header
  function getSessionCookie(req: Request): string | null {
    const cookies = req.headers.get("cookie") ?? "";
    for (const pair of cookies.split(";")) {
      const [name, ...rest] = pair.trim().split("=");
      if (name === cookieName) return rest.join("=");
    }
    return null;
  }

  // Check if a request is authenticated (has valid cookie OR valid token query param)
  function isAuthenticated(req: Request, url: URL): boolean {
    // Check cookie first (most requests)
    if (getSessionCookie(req) === sessionToken) return true;
    // Check query param (initial browser open)
    if (url.searchParams.get("token") === sessionToken) return true;
    return false;
  }

  // Build a Set-Cookie header that persists the session
  function sessionCookieHeader(): string {
    return `${cookieName}=${sessionToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`;
  }

  const server = Bun.serve({
    port,
    hostname: "127.0.0.1",
    async fetch(req) {
      const url = new URL(req.url);
      const path = url.pathname;
      const method = req.method;
      const reqOrigin = req.headers.get("origin");
      const cors = corsHeaders(reqOrigin, allowedOrigins);

      // Per-request json/jsonError with correct CORS origin
      const json = makeJsonFn(cors);
      const jsonError = makeJsonErrorFn(cors);

      // CORS preflight (no auth needed)
      if (method === "OPTIONS") {
        return new Response(null, { status: 204, headers: cors });
      }

      // --- Authentication ---
      // If the request has ?token= in the URL, validate it and set a cookie.
      // This is the initial browser open from the CLI.
      if (url.searchParams.has("token")) {
        if (url.searchParams.get("token") !== sessionToken) {
          return new Response("Unauthorized: invalid token", { status: 401 });
        }
        // Valid token — redirect to the same URL without the token param
        // and set the session cookie so future requests are authenticated.
        url.searchParams.delete("token");
        const cleanUrl = url.pathname + (url.search || "");
        return new Response(null, {
          status: 302,
          headers: {
            Location: cleanUrl || "/",
            "Set-Cookie": sessionCookieHeader(),
          },
        });
      }

      // All other requests must have the session cookie
      if (!isAuthenticated(req, url)) {
        if (path.startsWith("/api/")) {
          return jsonError("UNAUTHORIZED", "Session expired. Relaunch the dashboard.", 401);
        }
        return new Response(
          "Session expired or unauthorized. Relaunch the dashboard to get a new URL.",
          { status: 401, headers: { "Content-Type": "text/plain" } },
        );
      }

      // CSRF protection: block cross-origin mutations using exact origin match.
      // Reject if origin is missing (non-browser clients must not mutate via API)
      // or if origin is not in the allowlist.
      if (method !== "GET" && method !== "HEAD") {
        if (!reqOrigin || !allowedOrigins.includes(reqOrigin)) {
          return new Response("Forbidden: cross-origin request", {
            status: 403,
            headers: cors,
          });
        }
      }

      try {
        // --- Static assets ---
        if (method === "GET" && path === "/favicon.png") {
          const file = Bun.file(faviconPath);
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
        if (method === "GET" && (path === "/favicon.png" || path === "/favicon.ico")) {
          const file = Bun.file(faviconPath);
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

        // =================================================================
        // JSON API v2 routes — React dashboard
        // =================================================================

        // --- Providers v2 ---

        // GET /api/v2/providers — list providers with card data
        if (method === "GET" && path === "/api/v2/providers") {
          try {
            const providers = listProviders();
            const data = await Promise.all(
              providers.map(async (p) => {
                const hasCreds = await hasCredentials(p.alias);
                const accounts = getAccountsByProvider(p.id);
                const txCount = countTransactions({ providerId: p.id });
                return {
                  ...p,
                  hasCredentials: hasCreds,
                  accountCount: accounts.length,
                  transactionCount: txCount,
                };
              }),
            );
            return json(data);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return jsonError("PROVIDERS_LIST_FAILED", msg, 500);
          }
        }

        // POST /api/v2/providers — create provider
        if (method === "POST" && path === "/api/v2/providers") {
          try {
            const body = await parseJsonBody(req);
            const companyId = String(body.companyId ?? "");
            const alias = String(body.alias ?? companyId);
            const credentials = body.credentials as Record<string, string> | undefined;

            if (!isValidCompanyId(companyId)) {
              return jsonError("INVALID_COMPANY_ID", "Invalid provider type.");
            }
            if (!/^[a-zA-Z0-9_-]+$/.test(alias)) {
              return jsonError("INVALID_ALIAS", "Alias must contain only letters, numbers, dashes, and underscores.");
            }

            const info = PROVIDERS[companyId];

            if (credentials) {
              for (const field of info.loginFields) {
                if (field !== "otpLongTermToken" && !credentials[field]) {
                  return jsonError("MISSING_FIELD", `Missing required field: ${field}`);
                }
              }
              await storeCredentials(alias, credentials);
              // Zero credentials
              for (const key of Object.keys(credentials)) credentials[key] = "";
            }

            const provider = createProvider(companyId, info.displayName, info.type, alias);
            return json(provider, 201);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return jsonError("PROVIDER_CREATE_FAILED", msg, 500);
          }
        }

        // DELETE /api/v2/providers/:id — delete provider
        const v2DeleteProviderMatch = path.match(/^\/api\/v2\/providers\/(\d+)$/);
        if (method === "DELETE" && v2DeleteProviderMatch) {
          try {
            const provider = getProvider(Number(v2DeleteProviderMatch[1]));
            if (!provider) return jsonError("NOT_FOUND", "Provider not found.", 404);

            await deleteCredentials(provider.alias).catch(() => {});
            deleteProvider(provider.id);
            return json({ deleted: true, id: provider.id });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return jsonError("PROVIDER_DELETE_FAILED", msg, 500);
          }
        }

        // POST /api/v2/providers/:id/auth — update credentials
        const v2AuthMatch = path.match(/^\/api\/v2\/providers\/(\d+)\/auth$/);
        if (method === "POST" && v2AuthMatch) {
          try {
            const provider = getProvider(Number(v2AuthMatch[1]));
            if (!provider) return jsonError("NOT_FOUND", "Provider not found.", 404);

            const info = PROVIDERS[provider.companyId as CompanyId];
            if (!info) return jsonError("UNKNOWN_TYPE", "Unknown provider type.");

            const body = await parseJsonBody(req);
            const credentials = body.credentials as Record<string, string> | undefined;
            if (!credentials) return jsonError("MISSING_CREDENTIALS", "Credentials object is required.");

            for (const field of info.loginFields) {
              if (field !== "otpLongTermToken" && !credentials[field]) {
                return jsonError("MISSING_FIELD", `Missing required field: ${field}`);
              }
            }

            await storeCredentials(provider.alias, credentials);
            for (const key of Object.keys(credentials)) credentials[key] = "";

            return json({ updated: true });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return jsonError("AUTH_UPDATE_FAILED", msg, 500);
          }
        }

        // GET /api/v2/providers/fields/:companyId — get login fields
        const v2FieldsMatch = path.match(/^\/api\/v2\/providers\/fields\/([a-zA-Z]+)$/);
        if (method === "GET" && v2FieldsMatch) {
          try {
            const companyId = v2FieldsMatch[1];
            if (!isValidCompanyId(companyId)) {
              return jsonError("INVALID_COMPANY_ID", "Unknown provider type.");
            }
            const info = PROVIDERS[companyId];
            return json({ companyId, displayName: info.displayName, type: info.type, loginFields: info.loginFields });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return jsonError("FIELDS_FETCH_FAILED", msg, 500);
          }
        }

        // --- Accounts v2 ---

        // GET /api/v2/accounts/balance — balance report
        if (method === "GET" && path === "/api/v2/accounts/balance") {
          try {
            return json(getBalanceReport());
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return jsonError("BALANCE_FAILED", msg, 500);
          }
        }

        // --- Transactions v2 ---

        // GET /api/v2/transactions — list with filters
        if (method === "GET" && path === "/api/v2/transactions") {
          try {
            const sp = url.searchParams;
            const searchQuery = sp.get("search") ?? "";

            const filters: TransactionFilters = {};
            if (sp.has("from")) filters.from = sp.get("from")!;
            if (sp.has("to")) filters.to = sp.get("to")!;
            if (sp.has("provider")) filters.providerId = Number(sp.get("provider"));
            if (sp.has("category")) {
              const cat = sp.get("category")!;
              filters.category = cat === "Uncategorized" ? null : cat;
            }
            if (sp.has("status")) filters.status = sp.get("status") as TransactionFilters["status"];
            if (sp.has("minAmount")) filters.minAmount = Number(sp.get("minAmount"));
            if (sp.has("maxAmount")) filters.maxAmount = Number(sp.get("maxAmount"));
            if (sp.has("limit")) filters.limit = Math.min(Number(sp.get("limit")) || 50, MAX_PAGINATION_LIMIT);
            else filters.limit = 50;
            if (sp.has("offset")) filters.offset = Number(sp.get("offset"));

            const data = searchQuery
              ? searchTransactions(searchQuery, filters)
              : listTransactions(filters);

            const total = countTransactions(filters);
            return json({ transactions: data, total });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return jsonError("TRANSACTIONS_LIST_FAILED", msg, 500);
          }
        }

        // PATCH /api/v2/transactions/:id/category — update category
        const v2TxCategoryMatch = path.match(/^\/api\/v2\/transactions\/(\d+)\/category$/);
        if (method === "PATCH" && v2TxCategoryMatch) {
          try {
            const txId = Number(v2TxCategoryMatch[1]);
            const body = await parseJsonBody(req);
            // Allow null to mean "uncategorize", but reject missing/empty string
            const rawCategory = body.category;
            const category = rawCategory === null ? null : String(rawCategory || "");
            if (rawCategory === undefined || category === "") {
              return jsonError("MISSING_CATEGORY", "Category is required (use null to uncategorize).");
            }

            const updated = updateTransactionCategory(txId, category);
            if (!updated) return jsonError("NOT_FOUND", "Transaction not found.", 404);

            return json({ updated: true, id: txId, category });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return jsonError("TX_CATEGORY_UPDATE_FAILED", msg, 500);
          }
        }

        // --- Reports v2 ---

        // GET /api/v2/reports/monthly?from=&to=
        if (method === "GET" && path === "/api/v2/reports/monthly") {
          try {
            const from = url.searchParams.get("from") ?? undefined;
            const to = url.searchParams.get("to") ?? undefined;
            const excl = parseClassificationParams(url, DEFAULT_REPORT_EXCLUDES);
            return json(getMonthlyReport({ from, to }, undefined, excl));
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return jsonError("MONTHLY_REPORT_FAILED", msg, 500);
          }
        }

        // GET /api/v2/reports/categories?from=&to=
        if (method === "GET" && path === "/api/v2/reports/categories") {
          try {
            const from = url.searchParams.get("from") ?? undefined;
            const to = url.searchParams.get("to") ?? undefined;
            const excl = parseClassificationParams(url, DEFAULT_REPORT_EXCLUDES);
            return json(getCategoryReport({ from, to }, undefined, excl));
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return jsonError("CATEGORY_REPORT_FAILED", msg, 500);
          }
        }

        // GET /api/v2/reports/balance
        if (method === "GET" && path === "/api/v2/reports/balance") {
          try {
            const excl = parseClassificationParams(url, DEFAULT_REPORT_EXCLUDES);
            return json(getBalanceReport(excl));
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return jsonError("BALANCE_REPORT_FAILED", msg, 500);
          }
        }

        // --- Spending v2 ---

        // GET /api/v2/spending?month=&groupBy=&exclude=
        if (method === "GET" && path === "/api/v2/spending") {
          try {
            const sp = url.searchParams;
            const month = sp.get("month") ?? new Date().toISOString().slice(0, 7);
            const groupBy = (sp.get("groupBy") ?? "category") as "category" | "merchant" | "provider";
            const from = month + "-01";
            // End of month: next month first day minus 1
            const [year, mon] = month.split("-").map(Number);
            const lastDay = new Date(year, mon, 0).getDate();
            const to = `${month}-${String(lastDay).padStart(2, "0")}`;

            const excl = parseClassificationParams(url, DEFAULT_SPENDING_EXCLUDES);
            return json(getSpendingReport({ from, to, groupBy, excludeClassifications: excl }));
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return jsonError("SPENDING_REPORT_FAILED", msg, 500);
          }
        }

        // --- Income v2 ---

        // GET /api/v2/income?month=
        if (method === "GET" && path === "/api/v2/income") {
          try {
            const sp = url.searchParams;
            const month = sp.get("month") ?? new Date().toISOString().slice(0, 7);
            const from = month + "-01";
            const [year, mon] = month.split("-").map(Number);
            const lastDay = new Date(year, mon, 0).getDate();
            const to = `${month}-${String(lastDay).padStart(2, "0")}`;

            const excl = parseClassificationParams(url, DEFAULT_INCOME_EXCLUDES);
            return json(getIncomeReport({ from, to, excludeClassifications: excl }));
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return jsonError("INCOME_REPORT_FAILED", msg, 500);
          }
        }

        // --- Trends v2 ---

        // GET /api/v2/trends/total?months=
        if (method === "GET" && path === "/api/v2/trends/total") {
          try {
            const months = Number(url.searchParams.get("months") ?? "6");
            const now = new Date();
            const from = new Date(now.getFullYear(), now.getMonth() - months, 1)
              .toISOString()
              .slice(0, 10);
            const excl = parseClassificationParams(url, DEFAULT_REPORT_EXCLUDES);
            return json(getTotalTrends({ from }, undefined, excl));
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return jsonError("TRENDS_TOTAL_FAILED", msg, 500);
          }
        }

        // GET /api/v2/trends/category?category=&months=
        if (method === "GET" && path === "/api/v2/trends/category") {
          try {
            const category = url.searchParams.get("category") ?? "";
            if (!category) return jsonError("MISSING_CATEGORY", "category query param is required.");
            const months = Number(url.searchParams.get("months") ?? "6");
            const now = new Date();
            const from = new Date(now.getFullYear(), now.getMonth() - months, 1)
              .toISOString()
              .slice(0, 10);
            const excl = parseClassificationParams(url, DEFAULT_REPORT_EXCLUDES);
            return json(getCategoryTrends({ from }, category, undefined, excl));
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return jsonError("TRENDS_CATEGORY_FAILED", msg, 500);
          }
        }

        // GET /api/v2/trends/fixed-variable?months=
        if (method === "GET" && path === "/api/v2/trends/fixed-variable") {
          try {
            const months = Number(url.searchParams.get("months") ?? "6");
            const now = new Date();
            const from = new Date(now.getFullYear(), now.getMonth() - months, 1)
              .toISOString()
              .slice(0, 10);
            const excl = parseClassificationParams(url, DEFAULT_REPORT_EXCLUDES);
            return json(getFixedVariableTrends({ from }, undefined, excl));
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return jsonError("TRENDS_FIXED_VAR_FAILED", msg, 500);
          }
        }

        // --- Insights v2 ---

        // GET /api/v2/insights?months=
        if (method === "GET" && path === "/api/v2/insights") {
          try {
            const months = Number(url.searchParams.get("months") ?? "6");
            const now = new Date();
            const currentMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
            const from = new Date(now.getFullYear(), now.getMonth() - months, 1)
              .toISOString()
              .slice(0, 10);

            const excl = parseClassificationParams(url, DEFAULT_REPORT_EXCLUDES);
            const opts = { from, currentMonthStart, excludeClassifications: excl };

            // Fetch raw data from repositories
            const categoryByMonth = getCategoryByMonth(opts);
            const { transactions: largeTxs, avgAmount } = getLargeTransactions(opts);
            const merchantHistory = getMerchantHistory(opts);
            const monthCashflow = getMonthCashflow(opts);

            // Split current month vs prior for category spikes
            const currentMonthKey = currentMonthStart.slice(0, 7);
            const currentMonthCategories = categoryByMonth.filter((r) => r.month === currentMonthKey);
            const priorMonthCategories = categoryByMonth.filter((r) => r.month !== currentMonthKey);

            // Run detectors
            const insights = [
              ...detectCategorySpikes(currentMonthCategories, priorMonthCategories),
              ...detectLargeTransactions(largeTxs, avgAmount),
              ...detectNewMerchants(merchantHistory),
              ...detectRecurringChanges(merchantHistory),
              ...detectTrendWarnings(monthCashflow),
            ];

            return json(insights);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return jsonError("INSIGHTS_FAILED", msg, 500);
          }
        }

        // --- Categories v2 ---

        // GET /api/v2/categories/summary — category summary
        if (method === "GET" && path === "/api/v2/categories/summary") {
          try {
            return json(listCategories());
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return jsonError("CATEGORIES_SUMMARY_FAILED", msg, 500);
          }
        }

        // GET /api/v2/categories/all — flat category name list
        if (method === "GET" && path === "/api/v2/categories/all") {
          try {
            return json(listAllCategories());
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return jsonError("CATEGORIES_ALL_FAILED", msg, 500);
          }
        }

        // GET /api/v2/categories/transactions?cat= — transactions for category
        if (method === "GET" && path === "/api/v2/categories/transactions") {
          try {
            const cat = url.searchParams.get("cat") ?? "Uncategorized";
            const categoryFilter = cat === "Uncategorized" ? null : cat;
            const transactions = listTransactions({ category: categoryFilter, sort: "date" });
            return json(transactions);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return jsonError("CATEGORY_TX_FAILED", msg, 500);
          }
        }

        // POST /api/v2/categories — create category
        if (method === "POST" && path === "/api/v2/categories") {
          try {
            const body = await parseJsonBody(req);
            const name = String(body.name ?? "").trim();
            if (!name) return jsonError("MISSING_NAME", "Category name is required.");

            const created = createCategory(name);
            if (!created) return jsonError("ALREADY_EXISTS", "Category already exists.", 409);
            return json({ created: true, name }, 201);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return jsonError("CATEGORY_CREATE_FAILED", msg, 500);
          }
        }

        // POST /api/v2/categories/:name/rename
        const v2CatRenameMatch = path.match(/^\/api\/v2\/categories\/([^/]+)\/rename$/);
        if (method === "POST" && v2CatRenameMatch) {
          try {
            const oldName = decodeURIComponent(v2CatRenameMatch[1]);
            const body = await parseJsonBody(req);
            const newName = String(body.newName ?? "").trim();
            if (!newName) return jsonError("MISSING_NAME", "New name is required.");

            const result = renameCategory(oldName, newName);
            return json({ ...result, oldName, newName });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return jsonError("CATEGORY_RENAME_FAILED", msg, 500);
          }
        }

        // POST /api/v2/categories/:name/delete
        const v2CatDeleteMatch = path.match(/^\/api\/v2\/categories\/([^/]+)\/delete$/);
        if (method === "POST" && v2CatDeleteMatch) {
          try {
            const name = decodeURIComponent(v2CatDeleteMatch[1]);
            if (name === "Uncategorized") {
              return jsonError("CANNOT_DELETE", "Cannot delete Uncategorized.");
            }
            const body = await parseJsonBody(req);
            const reassignTo = String(body.reassignTo ?? "Uncategorized").trim();

            const result = deleteCategory(name, reassignTo);
            return json({ ...result, deleted: name, reassignedTo: reassignTo });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return jsonError("CATEGORY_DELETE_FAILED", msg, 500);
          }
        }

        // GET /api/v2/categories/rules — list rules
        if (method === "GET" && path === "/api/v2/categories/rules") {
          try {
            return json(listCategoryRules());
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return jsonError("CATEGORY_RULES_LIST_FAILED", msg, 500);
          }
        }

        // POST /api/v2/categories/rules — add rule
        if (method === "POST" && path === "/api/v2/categories/rules") {
          try {
            const body = await parseJsonBody(req);
            const category = String(body.category ?? "").trim();
            const conditions = body.conditions as RuleConditions | undefined;
            const priority = Number(body.priority ?? 0);

            if (!category) return jsonError("MISSING_CATEGORY", "Category is required.");
            if (!conditions) return jsonError("MISSING_CONDITIONS", "Conditions object is required.");

            // Validate regex patterns to prevent ReDoS
            for (const field of ["description", "memo"] as const) {
              const cond = conditions[field];
              if (cond && (cond as { mode: string }).mode === "regex") {
                if (!isSafeRegex((cond as { pattern: string }).pattern)) {
                  return jsonError("UNSAFE_REGEX", `Regex pattern for "${field}" is too complex or invalid.`);
                }
              }
            }

            const rule = addCategoryRule(category, conditions, priority);
            return json(rule, 201);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return jsonError("CATEGORY_RULE_ADD_FAILED", msg, 500);
          }
        }

        // DELETE /api/v2/categories/rules/:id — remove rule
        const v2DeleteCatRuleMatch = path.match(/^\/api\/v2\/categories\/rules\/(\d+)$/);
        if (method === "DELETE" && v2DeleteCatRuleMatch) {
          try {
            const id = Number(v2DeleteCatRuleMatch[1]);
            const removed = removeCategoryRule(id);
            if (!removed) return jsonError("NOT_FOUND", "Rule not found.", 404);
            return json({ deleted: true, id });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return jsonError("CATEGORY_RULE_DELETE_FAILED", msg, 500);
          }
        }

        // --- Classification management ---

        // GET /api/v2/classifications — list built-in classifications
        if (method === "GET" && path === "/api/v2/classifications") {
          return json(BUILTIN_CLASSIFICATIONS);
        }

        // GET /api/v2/categories/classifications — get classification map for all categories
        if (method === "GET" && path === "/api/v2/categories/classifications") {
          try {
            const map = getClassificationMap();
            const entries = Object.fromEntries(map);
            return json(entries);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return jsonError("CLASSIFICATION_MAP_FAILED", msg, 500);
          }
        }

        // PUT /api/v2/categories/:name/classification — set classification
        const v2CatClassMatch = path.match(/^\/api\/v2\/categories\/([^/]+)\/classification$/);
        if (method === "PUT" && v2CatClassMatch) {
          try {
            const name = decodeURIComponent(v2CatClassMatch[1]);
            const body = await parseJsonBody(req);
            const classification = String(body.classification ?? "").trim();
            if (!classification) return jsonError("MISSING_CLASSIFICATION", "classification is required.");
            if (!isValidClassification(classification)) {
              return jsonError("INVALID_CLASSIFICATION", "Classification must be lowercase alphanumeric + underscores.");
            }
            const updated = setCategoryClassification(name, classification);
            if (!updated) return jsonError("NOT_FOUND", "Category not found.", 404);
            return json({ name, classification });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return jsonError("CLASSIFICATION_SET_FAILED", msg, 500);
          }
        }

        // POST /api/v2/categories/apply — apply rules
        if (method === "POST" && path === "/api/v2/categories/apply") {
          try {
            const body = await parseJsonBody(req);
            const scope = (String(body.scope ?? "uncategorized")) as "uncategorized" | "all";
            const dryRun = body.dryRun === true;

            const result = applyCategoryRules({ scope, dryRun });
            return json(result);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return jsonError("CATEGORY_APPLY_FAILED", msg, 500);
          }
        }

        // --- Translations v2 ---

        // GET /api/v2/translations/untranslated — untranslated groups
        if (method === "GET" && path === "/api/v2/translations/untranslated") {
          try {
            return json(listUntranslatedGrouped());
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return jsonError("UNTRANSLATED_FAILED", msg, 500);
          }
        }

        // GET /api/v2/translations/translated — translated groups
        if (method === "GET" && path === "/api/v2/translations/translated") {
          try {
            return json(listTranslatedGrouped());
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return jsonError("TRANSLATED_FAILED", msg, 500);
          }
        }

        // GET /api/v2/translations/rules — list translation rules
        if (method === "GET" && path === "/api/v2/translations/rules") {
          try {
            return json(listTranslationRules());
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return jsonError("TRANSLATION_RULES_LIST_FAILED", msg, 500);
          }
        }

        // POST /api/v2/translations/rules — add translation rule
        if (method === "POST" && path === "/api/v2/translations/rules") {
          try {
            const body = await parseJsonBody(req);
            const englishName = String(body.englishName ?? "").trim();
            const matchPattern = String(body.matchPattern ?? "").trim();

            if (!englishName || !matchPattern) {
              return jsonError("MISSING_FIELDS", "Both englishName and matchPattern are required.");
            }

            const rule = addTranslationRule(englishName, matchPattern);
            return json(rule, 201);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return jsonError("TRANSLATION_RULE_ADD_FAILED", msg, 500);
          }
        }

        // DELETE /api/v2/translations/rules/:id — remove translation rule
        const v2DeleteTransRuleMatch = path.match(/^\/api\/v2\/translations\/rules\/(\d+)$/);
        if (method === "DELETE" && v2DeleteTransRuleMatch) {
          try {
            const id = Number(v2DeleteTransRuleMatch[1]);
            const removed = removeTranslationRule(id);
            if (!removed) return jsonError("NOT_FOUND", "Rule not found.", 404);
            return json({ deleted: true, id });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return jsonError("TRANSLATION_RULE_DELETE_FAILED", msg, 500);
          }
        }

        // POST /api/v2/translations/apply — apply translation rules
        if (method === "POST" && path === "/api/v2/translations/apply") {
          try {
            const result = applyTranslationRules();
            return json(result);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return jsonError("TRANSLATION_APPLY_FAILED", msg, 500);
          }
        }

        // POST /api/v2/translations/translate — translate single group
        if (method === "POST" && path === "/api/v2/translations/translate") {
          try {
            const body = await parseJsonBody(req);
            const hebrew = String(body.hebrew ?? "").trim();
            const english = String(body.english ?? "").trim();
            const createRule = body.createRule === true;

            if (!hebrew || !english) {
              return jsonError("MISSING_FIELDS", "Both hebrew and english are required.");
            }

            const count = translateByDescription(hebrew, english);

            if (createRule) {
              try {
                addTranslationRule(english, hebrew);
              } catch {
                // Rule might already exist — that's fine
              }
            }

            return json({ translated: count, hebrew, english, ruleCreated: createRule });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return jsonError("TRANSLATION_TRANSLATE_FAILED", msg, 500);
          }
        }

        // =================================================================
        // --- Fetch / Sync API ---

        // POST /api/v2/fetch — start a fetch (JSON body). Returns SSE stream.
        if (method === "POST" && path === "/api/v2/fetch") {
          if (activeFetch) {
            return jsonError("SYNC_IN_PROGRESS", "A sync is already in progress.", 409);
          }
          const body = await parseJsonBody(req);
          const visible = body.visible === true || body.visible === 1;
          return startFetchSSE(visible, jsonError);
        }

        // GET /api/v2/fetch/events — SSE stream for fetch progress
        if (method === "GET" && path === "/api/v2/fetch/events") {
          return fetchEventsSSE();
        }

        // --- React SPA fallback (never for /api/ routes) ---
        if (method === "GET" && !path.startsWith("/api/")) {
          // Try serving a static file from the React build output.
          // SECURITY: resolve the path and verify it stays within appDistDir
          // to prevent path traversal (e.g. /../../../etc/passwd).
          const assetPath = resolve(appDistDir, path.slice(1));
          if (!assetPath.startsWith(appDistDir)) {
            return new Response("Forbidden", { status: 403 });
          }
          const assetFile = Bun.file(assetPath);
          if (await assetFile.exists()) {
            return new Response(assetFile, {
              headers: {
                "Content-Type": getMimeType(assetPath),
                "Cache-Control": assetPath.includes("/assets/")
                  ? "public, max-age=31536000, immutable"
                  : "public, max-age=3600",
                ...SECURITY_HEADERS,
              },
            });
          }

          // SPA fallback: serve index.html for all unmatched GET routes
          const indexFile = Bun.file(resolve(appDistDir, "index.html"));
          if (await indexFile.exists()) {
            return new Response(indexFile, {
              headers: { "Content-Type": "text/html; charset=utf-8" },
            });
          }
        }

        // --- 404 ---
        if (path.startsWith("/api/")) {
          return jsonError("NOT_FOUND", `No route for ${method} ${path}`, 404);
        }
        return new Response("Not found", { status: 404 });
      } catch (err) {
        console.error("Dashboard error:", err);
        const msg = err instanceof Error ? err.message : String(err);
        return jsonError("SERVER_ERROR", sanitizeError(msg), 500);
      }
    },
  });

  return { server, token: sessionToken };
}

// --- SSE Helpers ---

function startFetchSSE(visible: boolean, jsonError: JsonErrorFn): Response {
  const events: string[] = [];
  const listeners: Set<(event: string) => void> = new Set();

  function pushEvent(data: string) {
    events.push(data);
    for (const listener of listeners) listener(data);
  }

  // Start fetch in background
  const providers = listProviders();
  if (providers.length === 0) {
    return jsonError("NO_PROVIDERS", "No providers configured.", 400);
  }

  pushEvent(
    JSON.stringify({
      type: "start",
      providers: providers.map((p) => p.alias),
      visible,
    }),
  );

  // Set activeFetch BEFORE starting the sync to prevent race condition
  // where double-click could start two syncs
  const placeholder = { promise: Promise.resolve(), events };
  activeFetch = placeholder;

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

  placeholder.promise = fetchPromise;

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
