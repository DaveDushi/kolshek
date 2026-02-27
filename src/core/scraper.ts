import { existsSync } from "fs";
import puppeteer, { type Browser } from "puppeteer-core";
import {
  createScraper,
  CompanyTypes,
  type ScraperOptions,
  type ScraperCredentials,
} from "israeli-bank-scrapers-core";
import { ScraperErrorTypes } from "israeli-bank-scrapers-core/lib/scrapers/errors";

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

export async function launchBrowser(chromePath: string): Promise<Browser> {
  const args = ["--disable-gpu"];
  // Only disable sandbox in CI/container environments where it's needed
  if (process.env.CI || process.env.KOLSHEK_NO_SANDBOX) {
    args.push("--no-sandbox");
  }
  return puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args,
  });
}

export async function closeBrowser(browser: Browser): Promise<void> {
  await browser.close();
}

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

  try {
    context = await browser.createBrowserContext();

    const scraperOpts: ScraperOptions = {
      companyId: companyType,
      startDate,
      browserContext: context as any,
      ...scraperOptions,
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
        error: result.errorMessage ?? "Scraping failed",
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
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      accounts: [],
      error: message,
      errorType: "GENERAL_ERROR",
    };
  } finally {
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
      return "GENERAL_ERROR";
    default:
      return "UNKNOWN";
  }
}
