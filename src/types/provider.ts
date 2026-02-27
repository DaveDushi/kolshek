/**
 * Provider = a bank OR credit card company.
 * Maps 1:1 with CompanyTypes from israeli-bank-scrapers.
 */

export type ProviderType = "bank" | "credit_card";

/** CompanyTypes enum values from israeli-bank-scrapers */
export type CompanyId =
  // Banks
  | "hapoalim"
  | "beinleumi"
  | "union"
  | "otsarHahayal"
  | "discount"
  | "mercantile"
  | "mizrahi"
  | "leumi"
  | "massad"
  | "yahav"
  | "oneZero"
  | "pagi"
  // Credit cards
  | "visaCal"
  | "max"
  | "isracard"
  | "amex"
  | "beyahadBishvilha"
  | "behatsdaa";

export interface ProviderInfo {
  companyId: CompanyId;
  displayName: string;
  type: ProviderType;
  loginFields: string[];
}

/** Stored provider record from the database */
export interface Provider {
  id: number;
  companyId: CompanyId;
  displayName: string;
  type: ProviderType;
  lastSyncedAt: string | null;
  createdAt: string;
}

/** All known providers with their metadata */
export const PROVIDERS: Record<CompanyId, ProviderInfo> = {
  // Banks
  hapoalim: {
    companyId: "hapoalim",
    displayName: "Bank Hapoalim",
    type: "bank",
    loginFields: ["username", "password"],
  },
  leumi: {
    companyId: "leumi",
    displayName: "Bank Leumi",
    type: "bank",
    loginFields: ["username", "password"],
  },
  discount: {
    companyId: "discount",
    displayName: "Bank Discount",
    type: "bank",
    loginFields: ["id", "password", "num"],
  },
  mizrahi: {
    companyId: "mizrahi",
    displayName: "Bank Mizrahi-Tefahot",
    type: "bank",
    loginFields: ["username", "password"],
  },
  mercantile: {
    companyId: "mercantile",
    displayName: "Bank Mercantile",
    type: "bank",
    loginFields: ["id", "password", "num"],
  },
  otsarHahayal: {
    companyId: "otsarHahayal",
    displayName: "Bank Otsar Hahayal",
    type: "bank",
    loginFields: ["username", "password"],
  },
  union: {
    companyId: "union",
    displayName: "Bank Union",
    type: "bank",
    loginFields: ["username", "password"],
  },
  beinleumi: {
    companyId: "beinleumi",
    displayName: "Bank Beinleumi",
    type: "bank",
    loginFields: ["username", "password"],
  },
  massad: {
    companyId: "massad",
    displayName: "Bank Massad",
    type: "bank",
    loginFields: ["username", "password"],
  },
  yahav: {
    companyId: "yahav",
    displayName: "Bank Yahav",
    type: "bank",
    loginFields: ["username", "password"],
  },
  oneZero: {
    companyId: "oneZero",
    displayName: "Bank One Zero",
    type: "bank",
    loginFields: ["email", "password", "otpLongTermToken"],
  },
  pagi: {
    companyId: "pagi",
    displayName: "Bank Pagi",
    type: "bank",
    loginFields: ["username", "password"],
  },
  // Credit cards
  visaCal: {
    companyId: "visaCal",
    displayName: "Visa Cal",
    type: "credit_card",
    loginFields: ["username", "password"],
  },
  max: {
    companyId: "max",
    displayName: "Max",
    type: "credit_card",
    loginFields: ["username", "password"],
  },
  isracard: {
    companyId: "isracard",
    displayName: "Isracard",
    type: "credit_card",
    loginFields: ["id", "card6Digits", "password"],
  },
  amex: {
    companyId: "amex",
    displayName: "American Express",
    type: "credit_card",
    loginFields: ["id", "card6Digits", "password"],
  },
  beyahadBishvilha: {
    companyId: "beyahadBishvilha",
    displayName: "Beyahad Bishvilha",
    type: "credit_card",
    loginFields: ["id", "password"],
  },
  behatsdaa: {
    companyId: "behatsdaa",
    displayName: "Behatsdaa",
    type: "credit_card",
    loginFields: ["id", "password"],
  },
};

export function getProvidersByType(type: ProviderType): ProviderInfo[] {
  return Object.values(PROVIDERS).filter((p) => p.type === type);
}

export function getProviderInfo(companyId: CompanyId): ProviderInfo | undefined {
  return PROVIDERS[companyId];
}

export function isValidCompanyId(id: string): id is CompanyId {
  return id in PROVIDERS;
}
