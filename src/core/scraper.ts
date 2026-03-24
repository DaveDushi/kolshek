import { existsSync } from "fs";
import vanillaPuppeteer, { type Browser } from "puppeteer-core";
import puppeteerExtra from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import {
  createScraper,
  CompanyTypes,
  type ScraperOptions,
  type ScraperCredentials,
} from "israeli-bank-scrapers-core";
import { ScraperErrorTypes } from "israeli-bank-scrapers-core/lib/scrapers/errors";
import { sanitizeErrorMessage } from "./sanitize.js";

// ---------------------------------------------------------------------------
// Chrome detection
// ---------------------------------------------------------------------------

const CHROME_PATHS: Record<string, string[]> = {
  win32: [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ],
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ],
  linux: [
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ],
};

export function findChromePath(): string | null {
  const envPath = process.env.KOLSHEK_CHROME_PATH;
  if (envPath && existsSync(envPath)) {
    return envPath;
  }

  const platformPaths = CHROME_PATHS[process.platform] ?? [];
  for (const p of platformPaths) {
    if (existsSync(p)) {
      return p;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScrapeOptions {
  companyId: string;
  credentials: Record<string, string>;
  startDate: Date;
  chromePath: string;
  onProgress?: (type: string) => void;
  browser?: Browser;
  scraperOptions?: Partial<ScraperOptions>;
  signal?: AbortSignal;
}

export interface ScrapeResult {
  success: boolean;
  accounts: Array<{
    accountNumber: string;
    balance?: number;
    txns: any[];
  }>;
  error?: string;
  errorType?: string;
}

// ---------------------------------------------------------------------------
// Browser lifecycle
// ---------------------------------------------------------------------------

export async function launchBrowser(
  chromePath: string,
  options?: { stealth?: boolean; headless?: boolean },
): Promise<Browser> {
  const args = ["--disable-gpu"];
  // Only disable sandbox in CI/container environments where it's needed
  if (process.env.CI || process.env.KOLSHEK_NO_SANDBOX) {
    args.push("--no-sandbox");
  }
  // Filter out KOLSHEK_ env vars to prevent credential leakage to child process
  const env: Record<string, string> = {};
  for (const [key, val] of Object.entries(process.env)) {
    if (!key.startsWith("KOLSHEK_") && val !== undefined) {
      env[key] = val;
    }
  }

  const launchOpts = {
    executablePath: chromePath,
    headless: options?.headless ?? true,
    args,
    env,
  };

  if (options?.stealth) {
    const stealth = puppeteerExtra.use(StealthPlugin());
    return stealth.launch(launchOpts) as unknown as Browser;
  }

  return vanillaPuppeteer.launch(launchOpts);
}

export async function closeBrowser(browser: Browser): Promise<void> {
  await browser.close();
}

// ---------------------------------------------------------------------------
// Rate-limit workaround for Isracard/Amex bot detection (PR #1027)
// ---------------------------------------------------------------------------

/** Providers that need throttled fetch() to avoid 429 "Block Automation" */
const THROTTLED_PROVIDERS = new Set(["isracard", "amex"]);

const THROTTLE_SCRIPT = `
(function() {
  const _origFetch = window.fetch;
  let _lastFetch = 0;
  const MIN_DELAY = 2500;
  const JITTER = 500;

  window.fetch = async function(...args) {
    const delay = MIN_DELAY + Math.floor(Math.random() * JITTER);
    const now = Date.now();
    const wait = Math.max(0, _lastFetch + delay - now);
    if (wait > 0) {
      await new Promise(r => setTimeout(r, wait));
    }
    _lastFetch = Date.now();
    return _origFetch.apply(this, args);
  };
})();
`;

// ---------------------------------------------------------------------------
// Scraper wrapper
// ---------------------------------------------------------------------------

export async function scrapeProvider(
  options: ScrapeOptions,
): Promise<ScrapeResult> {
  const {
    companyId,
    credentials,
    startDate,
    chromePath,
    onProgress,
    scraperOptions,
    signal,
  } = options;

  const companyType =
    CompanyTypes[companyId as keyof typeof CompanyTypes];
  if (companyType === undefined) {
    return {
      success: false,
      accounts: [],
      error: `Unknown company ID: ${companyId}`,
      errorType: "INVALID_COMPANY",
    };
  }

  // Use provided browser or launch a new one
  const ownBrowser = !options.browser;
  const browser = options.browser ?? (await launchBrowser(chromePath));
  let context: Awaited<ReturnType<Browser["createBrowserContext"]>> | null =
    null;

  // Abort handler — hoisted so it's accessible in finally for cleanup
  const onAbort = () => {
    context?.close().catch(() => {});
  };

  try {
    // Check if already cancelled before creating context
    if (signal?.aborted) {
      return {
        success: false,
        accounts: [],
        error: "Sync cancelled",
        errorType: "CANCELLED",
      };
    }

    context = await browser.createBrowserContext();

    // Register abort handler to close context and stop scraping
    signal?.addEventListener("abort", onAbort, { once: true });

    // Inject fetch throttling for providers prone to bot detection
    if (THROTTLED_PROVIDERS.has(companyId)) {
      const origNewPage = context.newPage.bind(context);
      context.newPage = async () => {
        const page = await origNewPage();
        await page.evaluateOnNewDocument(THROTTLE_SCRIPT);
        return page;
      };
    }

    const scraperOpts: ScraperOptions = {
      ...scraperOptions,
      companyId: companyType,
      startDate,
      browserContext: context as any,
    };

    const scraper = createScraper(scraperOpts);

    if (onProgress) {
      scraper.onProgress((_companyId, payload) => {
        onProgress(payload.type);
      });
    }

    const result = await scraper.scrape(
      credentials as unknown as ScraperCredentials,
    );

    if (!result.success) {
      return {
        success: false,
        accounts: [],
        error: sanitizeErrorMessage(result.errorMessage ?? "Scraping failed", credentials),
        errorType: mapErrorType(result.errorType),
      };
    }

    const accounts = (result.accounts ?? []).map((acct) => ({
      accountNumber: acct.accountNumber,
      balance: acct.balance,
      txns: acct.txns ?? [],
    }));

    return { success: true, accounts };
  } catch (err) {
    // If cancelled, return a clean cancellation result instead of the error
    // from the forcefully-closed browser context
    if (signal?.aborted) {
      return {
        success: false,
        accounts: [],
        error: "Sync cancelled",
        errorType: "CANCELLED",
      };
    }
    const message = sanitizeErrorMessage(
      err instanceof Error ? err.message : String(err),
      credentials,
    );
    return {
      success: false,
      accounts: [],
      error: message,
      errorType: "GENERAL_ERROR",
    };
  } finally {
    // Remove abort listener to avoid leaks (context may already be closed by onAbort)
    signal?.removeEventListener("abort", onAbort);
    if (context) {
      await context.close().catch(() => {});
    }
    if (ownBrowser) {
      await browser.close().catch(() => {});
    }
  }
}

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

function mapErrorType(
  scraperError: ScraperErrorTypes | undefined,
): string {
  if (!scraperError) return "UNKNOWN";

  switch (scraperError) {
    case ScraperErrorTypes.InvalidPassword:
      return "INVALID_CREDENTIALS";
    case ScraperErrorTypes.ChangePassword:
      return "CHANGE_PASSWORD";
    case ScraperErrorTypes.Timeout:
      return "TIMEOUT";
    case ScraperErrorTypes.AccountBlocked:
      return "ACCOUNT_BLOCKED";
    case ScraperErrorTypes.Generic:
    case ScraperErrorTypes.General:
      return "GENERAL_ERROR";
    case ScraperErrorTypes.TwoFactorRetrieverMissing:
      return "TWO_FACTOR_MISSING";
    default:
      return "UNKNOWN";
  }
}
