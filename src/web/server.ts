// Dashboard HTTP server — Express with URL routing.
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { randomBytes } from "node:crypto";
import { setTimeout } from 'node:timers/promises';
import { WEB_FILES } from "./web-files.js";
import { computeAuthStatus } from "../core/auth-status.js";
import {
  startTwoFactorAuth,
  exchangeOtpToken,
  parseTwoFactorAuthInput,
} from "../core/two-factor-auth.js";
import {
  listProviders,
  createProvider,
  deleteProvider,
  getProvider,
  getMostRecentSyncTime,
  getProviderByAlias,
} from "../db/repositories/providers.js";
import { upsertAccount } from "../db/repositories/accounts.js"
import {
  listCategoryRules, applyCategoryRules, createCategoryRule, deleteCategoryRule,
  findRuleByConditions, listCategories, listAllCategories, getClassificationMap,
  createCategory, deleteCategory, renameCategory, updateCategoryClassification,
} from "../db/repositories/categories.js";
import {
  listTranslationRules, listUntranslatedGrouped, listTranslatedGrouped,
  createTranslationRule, deleteTranslationRule, applyTranslationRules,
  updateTranslationByDescription,
} from "../db/repositories/translations.js";
import { validatePage } from "../core/page-schema.js"
import {
  listCustomPages, getCustomPage, createCustomPage, updateCustomPage, deleteCustomPage,
} from "../db/repositories/custom-pages.js";
import {
  listTransactions, updateTransactionCategory, countTransactions, upsertTransaction
} from "../db/repositories/transactions.js";
import { getMonthlyReport, getBalanceReport } from "../db/repositories/reports.js";
import { listBudgets, setBudget } from "../db/repositories/budgets.js";
import { updateAccountExcluded, purgeAccountData, getAccountsByProvider } from "../db/repositories/accounts.js";
import { PROVIDERS } from "../types/provider.js";
import { storeCredentials, deleteCredentials, hasCredentials } from "../security/keychain.js";
import {
  readScheduleConfig, writeScheduleConfig, deleteScheduleConfig, resolveBinaryPath,
} from "../config/schedule.js";
import {
  registerSchedule, unregisterSchedule, checkScheduleRegistered, currentPlatform,
} from "../core/scheduler/index.js";
import { transactionHash, transactionUniqueId } from "../core/sync-engine.js"
import { fetchAndApplyRules } from "../services/sync.js";
import { executeQueryBatch } from "../services/query.js";
import { getSpending } from "../services/spending.js";
import { getIncome } from "../services/income.js";
import {
  getTotalTrendData,
  getCategoryTrendData,
  getFixedVariableTrendData,
} from "../services/trends.js";
import { getInsights } from "../services/insights.js";
import {
    hasSuccessfulSync,
    listRecentSyncLogs,
    countSyncLogsSince,
    getLatestCompletedSyncLog
} from "../db/repositories/sync-log.js";
import { parseMonthToRange } from "../shared/date-utils.js";
import { EventEmitter } from "node:events";

const pageEvents = new EventEmitter();


function firstQueryValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.length > 0) {
    const item = value[0];
    return typeof item === "string" ? item : String(item);
  }
  return undefined;
}

function parseOptionalNumber(value: unknown): number | undefined {
  const raw = firstQueryValue(value);
  if (raw == null || raw === "") return undefined;
  const num = Number(raw);
  return Number.isFinite(num) ? num : undefined;
}

function parseOptionalBoolean(value: unknown): boolean | undefined {
  const raw = firstQueryValue(value);
  if (raw == null || raw === "") return undefined;
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  return undefined;
}

function parseCsvList(value: unknown): string[] | undefined {
  const raw = firstQueryValue(value);
  if (raw == null || raw.trim() === "") return undefined;
  const values = raw.split(",").map((item) => item.trim()).filter(Boolean);
  return values.length > 0 ? values : undefined;
}

function parseStringBody(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function upsertTranslationRule(englishName: string, matchPattern: string) {
  const matches = listTranslationRules().filter((rule) => rule.matchPattern === matchPattern);
  if (matches.length > 0) {
    if (matches.length === 1 && matches[0].englishName === englishName) {
      return { rule: matches[0], created: false };
    }
    for (const rule of matches) {
      deleteTranslationRule(rule.id);
    }
    return { rule: createTranslationRule(englishName, matchPattern), created: true };
  }
  return { rule: createTranslationRule(englishName, matchPattern), created: true };
}

export function startDashboard(port: number) {
  const app = express();
  const authDisabled = process.env.KOLSHEK_DISABLE_AUTH === "1";
  const sessionToken = randomBytes(32).toString("hex");
  const cookieName = "kolshek_session";

  app.use(cors({ origin: true, credentials: true }));
  app.use(cookieParser());
  app.use(express.json());

  // Auth Middleware
  app.use((req, res, next) => {
    if (authDisabled)
      return next();
    if (req.query.token === sessionToken || req.cookies[cookieName] === sessionToken) {
      if (req.query.token) res.cookie(cookieName, sessionToken, { httpOnly: true, sameSite: 'strict' });
      return next();
    }
    if (req.path.startsWith("/api/")) return res.status(401).json({ success: false });
    res.status(401).send("Unauthorized");
  });

  // Asset Routes
  app.get("*", (req, res, next) => {
    const asset = WEB_FILES[req.path];
    if (asset) {
      res.setHeader("Content-Type", asset.mime);
      return res.send(asset.binary ? Buffer.from(asset.content, "base64") : asset.content);
    }
    next();
  });

  // --- API Routes ---

  // Sync / Fetch
  let currentSyncAbort: AbortController | null = null;

  // SSE over POST (current client)
  app.post("/api/v2/fetch", async (req, res) => {
    if (currentSyncAbort) {
      return res.status(409).json({ success: false, error: "Sync already in progress" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const sendEvent = (event: any) => {
      try {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
        // @ts-ignore
        if (typeof res.flush === "function") {
          // @ts-ignore
          res.flush();
        } else if (res.socket) {
          // Force flush for Express without compression
          // @ts-ignore
          res.socket.setNoDelay?.(true);
        }
      } catch (e) {
        console.error(`[SSE] Error sending event:`, e);
      }
    };

    const controller = new AbortController();

    res.on("close", () => {
      if (currentSyncAbort === controller) {
        controller.abort();
        currentSyncAbort = null;
      }
    });

    currentSyncAbort = controller;
    const {
      providers: providerIds,
      visible,
      from,
      to,
      force,
      type,
      stealth,
    } = req.body;

    try {
      const allProviders = listProviders();
      const ids = providerIds ? (Array.isArray(providerIds) ? providerIds : [providerIds]) : null;
      let targetProviders = ids
        ? allProviders.filter((p: any) => ids.map(String).includes(String(p.id)))
        : allProviders;

      if (type) {
        targetProviders = targetProviders.filter((p: any) => p.type === type);
      }

      if (targetProviders.length === 0) {
        sendEvent({ type: "error", error: "No providers selected or found" });
        return;
      }
      // 1. Send start event
      sendEvent({
        type: "start",
        providers: targetProviders.map((p: any) => p.alias),
      });

      // Re-introduce a small delay after sending the start event
      await setTimeout(100);
      const syncResult = await fetchAndApplyRules(targetProviders, {
        visible: !!visible,
        fromDate: from ? new Date(from) : undefined,
        toDate: to ? new Date(to) : undefined,
        force: !!force,
        stealth: !!stealth,
        signal: controller.signal,
        onProgress: (alias, stage) => {
          sendEvent({ type: "progress", provider: alias, stage });
        },
        onResult: (result) => {
          sendEvent({
            type: "result",
            provider: result.alias,
            success: result.success,
            added: result.transactionsAdded,
            updated: result.transactionsUpdated,
            error: result.error,
          });
        },
      });
      // Explicitly send results for any errors that might have occurred early
      if (syncResult.hasErrors) {
        for (const result of syncResult.results) {
          if (!result.success) {
            sendEvent({
              type: "result",
              provider: result.alias,
              success: result.success,
              added: result.transactionsAdded,
              updated: result.transactionsUpdated,
              error: result.error,
            });
          }
        }
      }

      sendEvent({ type: "done" });
    } catch (err: any) {
      console.error(`[SSE] Error during fetchAndApplyRules:`, err);
      if (err.name === "AbortError") {
        sendEvent({ type: "error", error: "Sync cancelled" });
      } else {
        sendEvent({ type: "error", error: err.message || "Unknown error" });
      }
    } finally {
      if (currentSyncAbort === controller) {
        currentSyncAbort = null;
      }
      res.end();
    }
  });

  // Compatibility: SSE over GET for older clients using EventSource
  app.get("/api/v2/fetch/events", async (req, res) => {
    if (currentSyncAbort) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();
      res.write(`data: ${JSON.stringify({ type: "error", error: "Sync already in progress" })}\n\n`);
      return res.end();
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const sendEvent = (event: any) => {
      try {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
        // @ts-ignore
        if (typeof res.flush === "function") {
          // @ts-ignore
          res.flush();
        } else if (res.socket) {
          // @ts-ignore
          res.socket.setNoDelay?.(true);
        }
      } catch (e) {
        console.error(`[SSE-GET] Error sending event:`, e);
      }
    };

    const controller = new AbortController();

    res.on("close", () => {
      if (currentSyncAbort === controller) {
        controller.abort();
        currentSyncAbort = null;
      }
    });

    currentSyncAbort = controller;
    const visible = req.query.visible === "true" || req.query.visible === "1";
    const providersParam = req.query.providers as string | string[] | undefined;

    try {
      const allProviders = listProviders();
      let ids: (string | number)[] | null = null;
      if (providersParam) {
        if (Array.isArray(providersParam)) {
          ids = providersParam;
        } else {
          ids = providersParam.split(",").map((p) => p.trim()).filter(Boolean);
        }
      }
      const targetProviders = ids
        ? allProviders.filter((p: any) => ids!.map(String).includes(String(p.id)))
        : allProviders;

      if (targetProviders.length === 0) {
        sendEvent({ type: "error", error: "No providers selected or found" });
        return;
      }

      sendEvent({
        type: "start",
        providers: targetProviders.map((p: any) => p.alias),
      });

      // Re-introduce a small delay after sending the start event
      await setTimeout(100);
      const syncResult = await fetchAndApplyRules(targetProviders, {
        visible: !!visible,
        signal: controller.signal,
        onProgress: (alias, stage) => {
          sendEvent({ type: "progress", provider: alias, stage });
        },
        onResult: (result) => {
          sendEvent({
            type: "result",
            provider: result.alias,
            success: result.success,
            added: result.transactionsAdded,
            updated: result.transactionsUpdated,
            error: result.error,
          });
        },
      });
      // Explicitly send results for any errors that might have occurred early
      if (syncResult.hasErrors) {
        for (const result of syncResult.results) {
          if (!result.success) {
            sendEvent({
              type: "result",
              provider: result.alias,
              success: result.success,
              added: result.transactionsAdded,
              updated: result.transactionsUpdated,
              error: result.error,
            });
          }
        }
      }

      sendEvent({ type: "done" });
    } catch (err: any) {
      if (err.name === "AbortError") {
        sendEvent({ type: "error", error: "Sync cancelled" });
      } else {
        sendEvent({ type: "error", error: err.message || "Unknown error" });
      }
    } finally {
      if (currentSyncAbort === controller) {
        currentSyncAbort = null;
      }
      res.end();
    }
  });

  app.post("/api/v2/fetch/cancel", (_req, res) => {
    if (currentSyncAbort) {
      currentSyncAbort.abort();
      currentSyncAbort = null;
    }
    res.json({ success: true });
  });

  // Schedule
  app.get("/api/v2/schedule", async (_req, res) => {
    const config = await readScheduleConfig();
    const registered = await checkScheduleRegistered();

    // Missed runs calculation
    let missedRuns = 0;
    if (registered && config?.intervalHours && config?.registeredAt) {
      const lastSync = getMostRecentSyncTime();
      const startTracking = lastSync || config.registeredAt;
      const hoursSince = (Date.now() - new Date(startTracking).getTime()) / (1000 * 60 * 60);
      const expectedSyncs = Math.floor(hoursSince / config.intervalHours);
      const actualSyncs = countSyncLogsSince(startTracking);
      missedRuns = Math.max(0, expectedSyncs - actualSyncs);
    }

    res.json({
      success: true,
      data: {
        schedule: {
          registered,
          intervalHours: config?.intervalHours,
          registeredAt: config?.registeredAt,
          platform: currentPlatform(),
        },
        syncHistory: listRecentSyncLogs(20),
        missedRuns,
      },
    });
  });

  app.post("/api/v2/schedule", async (req, res) => {
    const { intervalHours } = req.body;
    const binaryPath = await resolveBinaryPath();
    const config = {
      intervalHours,
      binaryPath,
      registeredAt: new Date().toISOString(),
      platform: currentPlatform(),
    };
    await registerSchedule(config);
    await writeScheduleConfig(config);
    res.json({ success: true });
  });

  app.delete("/api/v2/schedule", async (_req, res) => {
    await unregisterSchedule();
    await deleteScheduleConfig();
    res.json({ success: true });
  });

  app.get("/api/v2/providers", async (_req, res) => {
    const providers = listProviders();
    const data = await Promise.all(providers.map(async p => {
      const hasCreds = await hasCredentials(p.alias);
      const accounts = getAccountsByProvider(p.id);
      const latestSync = getLatestCompletedSyncLog(p.id);
      const everSucceeded = hasSuccessfulSync(p.id);
      const authStatus = computeAuthStatus(
        hasCreds,
        (latestSync?.status as "success" | "error") ?? null,
        everSucceeded,
      );

      return {
        ...p,
        hasCredentials: hasCreds,
        authStatus,
        accounts,
        accountCount: accounts.length,
        transactionCount: countTransactions({ providerId: p.id })
      };
    }));
    res.json({ success: true, data });
  });

  app.post("/api/v2/providers", async (req, res) => {
    try {
      const { companyId, alias, displayName, credentials } = req.body;
      const type = PROVIDERS[companyId as keyof typeof PROVIDERS]?.type || "bank";
      const effectiveAlias = parseStringBody(alias) || parseStringBody(displayName) || companyId;

      if (getProviderByAlias(effectiveAlias)) {
        return res.status(409).json({
          success: false,
          error: {
            code: "ALIAS_EXISTS",
            message: `A provider with alias "${effectiveAlias}" already exists`,
          },
        });
      }

      const provider = createProvider(companyId, displayName || companyId, type, effectiveAlias);
      if (provider.companyId === "external_deposit") { // Accept amount/date via credentials for consistency with the UI
        const amtRaw = credentials?.amount ?? req.body?. amount;
        const dateRaw = credentials?.date ?? req.body?.date;
        const amount = typeof amtRaw === "string"? Number(amtRaw) : Number (amtRaw ?? NaN);
        if (!Number.isFinite (amount)) { // Clean up provider record
            deleteProvider(provider.id);
            return res.status(400).json({success: false,  error: { code: "INVALID_AMOUNT", message: "Invalid deposit amount" },  });
        }
        // Create an account and a completed transaction
        const account = upsertAccount (provider.id, "external", provider.companyId, amount, "ILS");
        const dateIso = dateRaw ? new Date(dateRaw).toISOString(): new Date().toISOString();
        const desc = "External deposit";
        const hash = transactionHash({ date: dateIso, chargedAmount: amount, description: desc}, provider.companyId, account.accountNumber);
        const uniqueId = transactionUniqueId({ date: dateIso, chargedAmount: amount, description: desc}, provider.companyId, account.accountNumber);
        upsertTransaction({
          accountId: account.id,
          type:"normal",
          date: dateIso,
          processedDate: dateIso,
          originalAmount: amount,
          originalCurrency: "ILS",
          chargedAmount: amount,
          chargedCurrency: "ILS",
          description: desc,
          status: "completed",
          hash,
          uniqueId,
        });
        return res.json({
          success: true,
          data: {
            ...provider,
            hasCredentials: false,
            authStatus: "connected",
            accounts: [account],
            accountCount: 1,
            transactionCount: 1,
            requiresOtp: false,
          },
        });
      }

      let requiresOtp = false;
      let hasCredentials = false;
      let authStatus = "no";
      if (credentials) {
        if (provider.companyId === "oneZero" && parseTwoFactorAuthInput(credentials) && !credentials.otpLongTermToken) {
          try {
            const otpResult = await startTwoFactorAuth(provider.companyId, credentials.phoneNumber);
            if (otpResult.success) {
              requiresOtp = true;
              authStatus = "pending";
            }
          } catch (err) {
            deleteProvider(provider.id);
            return res.status(400).json({
              success: false,
              error: {
                code: "OTP_TRIGGER_FAILED",
                message: err instanceof Error ? err.message : "Failed to start OTP authentication",
              },
            });
          }
        } else {
          await storeCredentials(provider.alias, credentials);
          hasCredentials = true;
          authStatus = "pending";
        }
      }

      return res.json({
        success: true,
        data: {
          ...provider,
          hasCredentials,
          authStatus,
          accounts: [],
          accountCount: 0,
          transactionCount: 0,
          requiresOtp,
        },
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: {
          code: "PROVIDER_CREATE_FAILED",
          message: err instanceof Error ? err.message : "Failed to create provider",
        },
      });
    }
  });

  app.delete("/api/v2/providers/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const provider = getProvider(id);
    if (provider) {
      await deleteCredentials(provider.alias);
      deleteProvider(id);
    }
    res.json({ success: true });
  });

  app.post("/api/v2/providers/:id/auth", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { credentials, otpCode } = req.body;
      const provider = getProvider(id);
      if (!provider) {
        return res.status(404).json({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Provider not found",
          },
        });
      }

      const otp = parseStringBody(otpCode);
      if (otp) {
        try {
          if (!credentials || !credentials.phoneNumber) {
            throw new Error("Missing phone number for OTP exchange");
          }
          const otpLongTermToken = await exchangeOtpToken(credentials.phoneNumber, otp);
          await storeCredentials(provider.alias, {
              email: credentials.email,
              password: credentials.password,
              otpLongTermToken: otpLongTermToken,
            });
          return res.json({
            success: true,
            data: {
              ...provider,
              hasCredentials: true,
              authStatus: "pending",
              accounts: [],
              accountCount: 0,
              transactionCount: 0,
              requiresOtp: false,
            },
          });
        } catch (err) {
          return res.status(400).json({
            success: false,
            error: {
              code: "OTP_COMPLETE_FAILED",
              message: err instanceof Error ? err.message : "Failed to complete OTP authentication",
            },
          });
        }
      }

      if (!credentials) {
        return res.status(400).json({
          success: false,
          error: {
            code: "MISSING_CREDENTIALS",
            message: "Missing credentials",
          },
        });
      }

      if (provider.companyId === "external_deposit") { // Accept amount/date via credentials for consistency with the UI
        const amtRaw = credentials?.amount ?? req.body?. amount;
        const dateRaw = credentials?.date ?? req.body?.date;
        const amount = typeof amtRaw === "string"? Number(amtRaw) : Number (amtRaw ?? NaN);
        if (!Number.isFinite (amount)) { // Clean up provider record
            deleteProvider(provider.id);
            return res.status(400).json({success: false,  error: { code: "INVALID_AMOUNT", message: "Invalid deposit amount" },  });
        }
        // Create an account and a completed transaction
        const account = upsertAccount (provider.id, "external", provider.companyId, amount, "ILS");
        const dateIso = dateRaw ? new Date(dateRaw).toISOString(): new Date().toISOString();
        const desc = "External deposit";
        const hash = transactionHash({ date: dateIso, chargedAmount: amount, description: desc}, provider.companyId, account.accountNumber);
        const uniqueId = transactionUniqueId({ date: dateIso, chargedAmount: amount, description: desc}, provider.companyId, account.accountNumber);
        upsertTransaction({
          accountId: account.id,
          type:"normal",
          date: dateIso,
          processedDate: dateIso,
          originalAmount: amount,
          originalCurrency: "ILS",
          chargedAmount: amount,
          chargedCurrency: "ILS",
          description: desc,
          status: "completed",
          hash,
          uniqueId,
        });
        return res.json({
          success: true,
          data: {
            ...provider,
            hasCredentials: false,
            authStatus: "connected",
            accounts: [account],
            accountCount: 1,
            transactionCount: 1,
            requiresOtp: false,
          },
        });
      }

      if (provider.companyId === "oneZero" && !credentials.phoneNumber) {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_CREDENTIALS",
            message: "One Zero credentials require email, password, and phoneNumber",
          },
        });
      }

      if (provider.companyId === "oneZero" && parseTwoFactorAuthInput(credentials) && !credentials.otpLongTermToken) {
        try {
          const otpResult = await startTwoFactorAuth(provider.companyId, credentials.phoneNumber);
          if (otpResult.success)
            return res.json({
                success: true,
                data: {
                  ...provider,
                  hasCredentials: false,
                  authStatus: "pending",
                  accounts: [],
                  accountCount: 0,
                  transactionCount: 0,
                  requiresOtp: true,
                },
          });
        } catch (err) {
          return res.status(400).json({
            success: false,
            error: {
              code: "OTP_TRIGGER_FAILED",
              message: err instanceof Error ? err.message : "Failed to start OTP authentication",
            },
          });
        }
      }

      await storeCredentials(provider.alias, credentials);
      return res.json({
        success: true,
        data: {
          ...provider,
          hasCredentials: true,
          authStatus: "pending",
          accounts: [],
          accountCount: 0,
          transactionCount: 0,
          requiresOtp: false,
        },
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: {
          code: "PROVIDER_AUTH_FAILED",
          message: err instanceof Error ? err.message : "Failed to update provider credentials",
        },
      });
    }
  });

  app.get("/api/v2/providers/fields/:companyId", (req, res) => {
    const info = PROVIDERS[req.params.companyId as keyof typeof PROVIDERS];
    res.json({ success: true, data: { loginFields: info?.loginFields || [] } });
  });

  app.get("/api/v2/accounts/balance", (_req, res) => {
    res.json({ success: true, data: getBalanceReport() });
  });

  app.patch("/api/v2/accounts/:id", (req, res) => {
    updateAccountExcluded(parseInt(req.params.id), req.body.excluded);
    res.json({ success: true });
  });

  app.delete("/api/v2/accounts/:id/data", (req, res) => {
    purgeAccountData(parseInt(req.params.id));
    res.json({ success: true });
  });

  app.get("/api/v2/pages/events", (_req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const onPageChanged = (id: string) => {
      res.write(`data: ${JSON.stringify({ type: "page_changed", id })}\n\n`);
    };

    const onPageDeleted = (id: string) => {
      res.write(`data: ${JSON.stringify({ type: "page_deleted", id })}\n\n`);
    };

    pageEvents.on("changed", onPageChanged);
    pageEvents.on("deleted", onPageDeleted);

    const timer = setInterval(() => {
      res.write("data: ping\n\n");
    }, 30000);

    res.on("close", () => {
      clearInterval(timer);
      pageEvents.off("changed", onPageChanged);
      pageEvents.off("deleted", onPageDeleted);
    });
  });

  app.get("/api/v2/pages", (_req, res) => {
    res.json({ success: true, data: listCustomPages() });
  });

  app.get("/api/v2/pages/:id", (req, res) => {
    const page = getCustomPage(req.params.id);
    if (!page) {
      return res.status(404).json({ success: false, error: "Page not found" });
    }
    res.json({ success: true, data: page });
  });

  app.post("/api/v2/pages", (req, res) => {
    const verify = validatePage(req.body)
    if (!verify.success)
      return res.status(400).json(verify)
    const created = createCustomPage(req.body);
    pageEvents.emit("changed", created.id);
    res.json({ success: true, data: created });
  });

  app.put("/api/v2/pages/:id", (req, res) => {
    const updated = updateCustomPage(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, error: "Page not found" });
    }
    pageEvents.emit("changed", updated.id);
    res.json({ success: true, data: updated });
  });

  app.delete("/api/v2/pages/:id", (req, res) => {
    const deleted = deleteCustomPage(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: "Page not found" });
    }
    pageEvents.emit("deleted", req.params.id);
    res.json({ success: true });
  });

  app.post("/api/v2/query", (req, res) => {
    const { queries } = req.body;
    if (!Array.isArray(queries)) {
      return res.status(400).json({ success: false, error: "Invalid queries format" });
    }
    const results = executeQueryBatch(queries);
    res.json({ success: true, data: results });
  });

  // Categories
  app.get("/api/v2/categories/summary", (_req, res) => {
    res.json({ success: true, data: listCategories() });
  });

  app.get("/api/v2/categories/all", (_req, res) => {
    res.json({ success: true, data: listAllCategories() });
  });

  app.get("/api/v2/categories/transactions", (req, res) => {
    const category = firstQueryValue(req.query.cat);
    if (!category) {
      return res.status(400).json({ success: false, error: "Missing category" });
    }
    res.json({
      success: true,
      data: listTransactions({ category }),
    });
  });

  app.post("/api/v2/categories", (req, res) => {
    const name = parseStringBody(req.body.name);
    const classification = parseStringBody(req.body.classification) || "expense";
    if (!name) {
      return res.status(400).json({ success: false, error: "Missing category name" });
    }
    const created = createCategory(name, classification as any);
    res.json({
      success: true,
      data: { name, classification, created },
    });
  });

  app.post("/api/v2/categories/:name/rename", (req, res) => {
    const name = req.params.name;
    const newName = parseStringBody(req.body.newName);
    if (!name || !newName) {
      return res.status(400).json({ success: false, error: "Missing category name" });
    }
    const result = renameCategory(name, newName);
    res.json({ success: true, data: result });
  });

  app.post("/api/v2/categories/:name/delete", (req, res) => {
    const name = req.params.name;
    if (!name) {
      return res.status(400).json({ success: false, error: "Missing category name" });
    }
    const result = deleteCategory(name, "Uncategorized");
    res.json({ success: true, data: result });
  });

  app.put("/api/v2/categories/:name/classification", (req, res) => {
    const name = req.params.name;
    const classification = parseStringBody(req.body.classification);
    if (!name || !classification) {
      return res.status(400).json({ success: false, error: "Missing classification" });
    }
    updateCategoryClassification(name, classification as any);
    res.json({ success: true, data: { name, classification } });
  });

  app.get("/api/v2/categories/rules", (_req, res) => {
    res.json({ success: true, data: listCategoryRules() });
  });

  app.post("/api/v2/categories/rules", (req, res) => {
    const category = parseStringBody(req.body.category);
    const conditions = req.body.conditions ?? {};
    const priority = typeof req.body.priority === "number" ? req.body.priority : Number(req.body.priority ?? 0);
    if (!category) {
      return res.status(400).json({ success: false, error: "Missing category" });
    }

    const existing = findRuleByConditions(conditions);
    const rule = existing ?? createCategoryRule(category, conditions, Number.isFinite(priority) ? priority : 0);
    const applyResult = applyCategoryRules();

    res.json({
      success: true,
      data: {
        rule,
        created: !existing,
        applied: applyResult.applied,
        uncategorized: applyResult.uncategorized,
      },
    });
  });

  app.delete("/api/v2/categories/rules/:id", (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, error: "Invalid rule id" });
    }
    res.json({ success: true, data: { deleted: deleteCategoryRule(id) } });
  });

  app.post("/api/v2/categories/apply", (req, res) => {
    const scope = req.body?.scope;
    const fromCategory = parseStringBody(req.body?.fromCategory);
    const dryRun = req.body?.dryRun === true;
    const result = applyCategoryRules({
      scope: scope === "all" || scope === "from-category" ? scope : "uncategorized",
      fromCategory: fromCategory || undefined,
      dryRun,
    });
    res.json({ success: true, data: result });
  });

  app.get("/api/v2/categories/classifications", (_req, res) => {
    res.json({
      success: true,
      data: Object.fromEntries(getClassificationMap().entries()),
    });
  });

  // Translations
  app.get("/api/v2/translations/untranslated", (req, res) => {
    res.json({
      success: true,
      data: listUntranslatedGrouped({
        limit: parseOptionalNumber(req.query.limit),
        offset: parseOptionalNumber(req.query.offset),
      }),
    });
  });

  app.get("/api/v2/translations/translated", (req, res) => {
    res.json({
      success: true,
      data: listTranslatedGrouped({
        limit: parseOptionalNumber(req.query.limit),
        offset: parseOptionalNumber(req.query.offset),
        search: firstQueryValue(req.query.search),
      }),
    });
  });

  app.get("/api/v2/translations/rules", (_req, res) => {
    res.json({ success: true, data: listTranslationRules() });
  });

  app.post("/api/v2/translations/rules", (req, res) => {
    const englishName = parseStringBody(req.body.englishName);
    const matchPattern = parseStringBody(req.body.matchPattern);
    if (!englishName || !matchPattern) {
      return res.status(400).json({ success: false, error: "Missing translation rule fields" });
    }

    const { rule, created } = upsertTranslationRule(englishName, matchPattern);
    res.json({ success: true, data: { rule, created } });
  });

  app.delete("/api/v2/translations/rules/:id", (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, error: "Invalid rule id" });
    }
    res.json({ success: true, data: { deleted: deleteTranslationRule(id) } });
  });

  app.post("/api/v2/translations/apply", (_req, res) => {
    res.json({ success: true, data: applyTranslationRules() });
  });

  app.post("/api/v2/translations/translate", (req, res) => {
    const hebrew = parseStringBody(req.body.hebrew);
    const english = parseStringBody(req.body.english);
    const createRule = req.body.createRule === true;
    if (!hebrew || !english) {
      return res.status(400).json({ success: false, error: "Missing translation fields" });
    }

    const updated = updateTranslationByDescription(hebrew, english);
    const rule = createRule ? upsertTranslationRule(english, hebrew) : null;
    res.json({
      success: true,
      data: {
        updated,
        rule: rule?.rule ?? null,
        ruleCreated: rule?.created ?? false,
      },
    });
  });

  // Income, Spending, Trends, Insights
  app.get("/api/v2/income", (req, res) => {
    const month = firstQueryValue(req.query.month);
    const salaryOnly = parseOptionalBoolean(req.query.salaryOnly);
    const includeRefunds = parseOptionalBoolean(req.query.includeRefunds);
    const excludeClassifications = parseCsvList(req.query.exclude);
    const result = getIncome({
      month: month || undefined,
      salaryOnly: salaryOnly ?? false,
      includeRefunds: includeRefunds ?? false,
      excludeClassifications,
    });
    res.json({ success: true, data: result });
  });

  app.get("/api/v2/spending", (req, res) => {
    const month = firstQueryValue(req.query.month);
    const groupBy = firstQueryValue(req.query.groupBy) || "category";
    const excludeClassifications = parseCsvList(req.query.exclude);
    const range = parseMonthToRange(month);
    if (!range) {
      return res.status(400).json({ success: false, error: "Invalid month" });
    }

    const result = getSpending({
      month: range.label,
      groupBy: groupBy as any,
      category: firstQueryValue(req.query.category) || undefined,
      providerType: firstQueryValue(req.query.type) || undefined,
      top: parseOptionalNumber(req.query.top),
      excludeClassifications,
    });
    res.json({ success: true, data: result });
  });

  app.get("/api/v2/trends/total", (req, res) => {
    const months = parseOptionalNumber(req.query.months) ?? 6;
    const excludeClassifications = parseCsvList(req.query.exclude);
    const providerType = firstQueryValue(req.query.type) || firstQueryValue(req.query.providerType) || undefined;
    res.json({
      success: true,
      data: getTotalTrendData({ months, providerType, excludeClassifications }),
    });
  });

  app.get("/api/v2/trends/category", (req, res) => {
    const category = firstQueryValue(req.query.category);
    if (!category) {
      return res.status(400).json({ success: false, error: "Missing category" });
    }
    const months = parseOptionalNumber(req.query.months) ?? 6;
    const excludeClassifications = parseCsvList(req.query.exclude);
    const providerType = firstQueryValue(req.query.type) || firstQueryValue(req.query.providerType) || undefined;
    res.json({
      success: true,
      data: getCategoryTrendData(category, { months, providerType, excludeClassifications }),
    });
  });

  app.get("/api/v2/trends/fixed-variable", (req, res) => {
    const months = parseOptionalNumber(req.query.months) ?? 6;
    const excludeClassifications = parseCsvList(req.query.exclude);
    const providerType = firstQueryValue(req.query.type) || firstQueryValue(req.query.providerType) || undefined;
    res.json({
      success: true,
      data: getFixedVariableTrendData({ months, providerType, excludeClassifications }),
    });
  });

  app.get("/api/v2/insights", (req, res) => {
    const months = parseOptionalNumber(req.query.months) ?? 3;
    const excludeClassifications = parseCsvList(req.query.exclude);
    const result = getInsights({ months, excludeClassifications });
    res.json({ success: true, data: result.insights });
  });

  // Transactions
  app.get("/api/v2/transactions", (req, res) => {
    const filters = req.query as any;
    res.json({
      success: true,
      data: {
        transactions: listTransactions(filters),
        total: countTransactions(filters)
      }
    });
  });

  app.patch("/api/v2/transactions/:id/category", (req, res) => {
    const id = parseInt(req.params.id);
    const { category } = req.body;
    updateTransactionCategory(id, category);
    res.json({ success: true });
  });

  // Budgets
  app.get("/api/v2/budgets", (_req, res) => res.json({ success: true, data: listBudgets() }));
  app.post("/api/v2/budgets", (req, res) => {
    setBudget(req.body.category, req.body.amount, req.body.period);
    res.json({ success: true });
  });

  // Reports
  app.get("/api/v2/reports/monthly", (req, res) => {
    const from = firstQueryValue(req.query.from);
    const to = firstQueryValue(req.query.to);
    const providerType = firstQueryValue(req.query.type) || firstQueryValue(req.query.providerType) || undefined;
    const excludeClassifications = parseCsvList(req.query.exclude);
    res.json({
      success: true,
      data: getMonthlyReport({ from, to }, providerType, excludeClassifications),
    });
  });

  app.get("/api/v2/reports/balance", (_req, res) => {
    res.json({ success: true, data: getBalanceReport() });
  });

  // Generic error handling for API routes
  app.use("/api/", (err: any, _req: any, res: any, next: any) => {
    if (err) {
      console.error("[API Error]", err);
      return res.status(err.status || 500).json({
        success: false,
        error: {
          code: err.code || "SERVER_ERROR",
          message: err.message || "An unexpected server error occurred.",
        },
      });
    }
    next();
  });

  // SPA Fallback
  app.get("*", (_req, res) => {
    res.setHeader("Content-Type", "text/html").send(WEB_FILES["/index.html"].content);
  });

  const server = app.listen(port, "0.0.0.0");
  return { server, token: sessionToken };
}