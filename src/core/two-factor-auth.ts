import { type CompanyId } from "../types/index.js";
import { createScraper, CompanyTypes } from "israeli-bank-scrapers-core";

interface TwoFactorAuthInput {
  email: string;
  password: string;
  phoneNumber: string;
};

interface TwoFactorAuthSession {
  scraper: ReturnType<typeof createScraper>;
  timeout: ReturnType<typeof setTimeout>;
};

const TWO_FACTOR_AUTH_TTL_MS = 10 * 60 * 1000;
const twoFactorAuthSessions = new Map<string, TwoFactorAuthSession>();

export function parseTwoFactorAuthInput(credentials: TwoFactorAuthInput): boolean {
  if (
    typeof credentials !== "object" ||
    credentials === null ||
    typeof credentials.email !== "string" ||
    typeof credentials.password !== "string" ||
    typeof credentials.phoneNumber !== "string"
  ) return false;
  return true;
}

export async function startTwoFactorAuth(
  companyId: CompanyId,
  phoneNumber: string,
): Promise<{ success: boolean }> {
  try {
    const scraperCheck = (CompanyTypes as Record<string, any>)[companyId];
    if (!scraperCheck) {
      throw new Error(`Two-factor authentication is not supported for provider: ${companyId}`);
    }

    const scraper = createScraper({
      companyId: scraperCheck,
      startDate: new Date(), // Not directly used for OTP, but required by interface
      verbose: true, // Enable for debugging
    });
    console.log(`Triggering OTP for phone number: ${phoneNumber}`);
    const result = await scraper.triggerTwoFactorAuth(phoneNumber);
    console.log(`OTP trigger result for ${phoneNumber}:`, result);
    if (!result.success) {
      throw new Error(result.errorMessage || "Failed to trigger OTP (scraper reported failure)");
    }
    startTwoFactorAuthSession(phoneNumber, scraper).catch(() => {});
    return result;
  } catch (err: any) {
    console.error(`Error occurred while triggering OTP for ${phoneNumber}:`, err);
    throw new Error(`OTP_TRIGGER_FAILED: ${err.message || "Unknown error during OTP trigger process."}`);
  }
}

export async function exchangeOtpToken(
  phoneNumber: string,
  otpCode: string,
): Promise<string> {
  const session = twoFactorAuthSessions.get(phoneNumber);
  if (!session) {
    throw new Error("No pending Two-Factor OTP session found. Start authentication again.");
  }

  const result = await session.scraper.getLongTermTwoFactorToken(otpCode);
  if (!result.success) {
    throw new Error(result.errorMessage || "Failed to exchange OTP code for long-term token");
  }
  if (!result.longTermTwoFactorAuthToken) {
    throw new Error("Provider did not return a long-term OTP token");
  }
  closeTwoFactorAuthSession(phoneNumber).catch(() => {});
  return result.longTermTwoFactorAuthToken;
}

async function startTwoFactorAuthSession(
  phoneNumber: string,
  scraper: ReturnType<typeof createScraper>,
): Promise<void> {
  closeTwoFactorAuthSession(phoneNumber);
  const timeout = setTimeout(() => {
    twoFactorAuthSessions.delete(phoneNumber);
  }, TWO_FACTOR_AUTH_TTL_MS);
  timeout.unref?.();
  twoFactorAuthSessions.set(phoneNumber, {
      scraper, timeout
  });
}

async function closeTwoFactorAuthSession(phoneNumber: string): Promise<void> {
  const session = twoFactorAuthSessions.get(phoneNumber);
  if (!session) return;
  twoFactorAuthSessions.delete(phoneNumber);
}