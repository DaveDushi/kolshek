/**
 * Mock data matching israeli-bank-scrapers response shapes.
 * Used across unit and integration tests.
 */

/** A single scraped transaction (matching israeli-bank-scrapers Transaction shape) */
export interface MockScraperTransaction {
  type?: string;
  identifier?: string | number | null;
  date: string;
  processedDate?: string;
  originalAmount?: number;
  originalCurrency?: string;
  chargedAmount: number;
  chargedCurrency?: string;
  description: string;
  memo?: string | null;
  status?: string;
  category?: string;
  installments?: { number: number; total: number } | null;
}

/** A single scraped account (matching israeli-bank-scrapers Account shape) */
export interface MockScraperAccount {
  accountNumber: string;
  balance?: number;
  txns: MockScraperTransaction[];
}

/** Full scraper result for a provider */
export interface MockScrapeResult {
  success: boolean;
  accounts: MockScraperAccount[];
  error?: string;
}

// ---------------------------------------------------------------------------
// Bank provider: Hapoalim — 2 accounts (checking + savings)
// ---------------------------------------------------------------------------

const hapoalimCheckingTxns: MockScraperTransaction[] = [
  {
    type: "normal",
    identifier: "TXN-HP-001",
    date: "2025-12-01T00:00:00.000Z",
    processedDate: "2025-12-02T00:00:00.000Z",
    chargedAmount: -249.9,
    description: "Shufersal Deal",
    memo: "Branch 42 Ramat Gan",
    status: "completed",
  },
  {
    type: "normal",
    identifier: "TXN-HP-002",
    date: "2025-12-03T00:00:00.000Z",
    processedDate: "2025-12-04T00:00:00.000Z",
    chargedAmount: -89.0,
    description: "Rami Levy",
    memo: null,
    status: "completed",
  },
  {
    type: "normal",
    identifier: "TXN-HP-003",
    date: "2025-12-05T00:00:00.000Z",
    processedDate: "2025-12-06T00:00:00.000Z",
    chargedAmount: 15000,
    description: "Salary Deposit",
    memo: "Acme Corp Ltd",
    status: "completed",
  },
  {
    type: "normal",
    identifier: "TXN-HP-004",
    date: "2025-12-07T00:00:00.000Z",
    processedDate: "2025-12-07T00:00:00.000Z",
    chargedAmount: -42.5,
    description: "Wolt",
    memo: "Order #W12345",
    status: "pending",
  },
  {
    type: "normal",
    identifier: "TXN-HP-005",
    date: "2025-12-08T00:00:00.000Z",
    processedDate: "2025-12-09T00:00:00.000Z",
    chargedAmount: 0,
    description: "Fee Reversal",
    memo: "Refund for overdraft fee",
    status: "completed",
  },
  {
    type: "installments",
    identifier: "TXN-HP-006",
    date: "2025-12-10T00:00:00.000Z",
    processedDate: "2025-12-11T00:00:00.000Z",
    chargedAmount: -350,
    description: "HOT Mobile",
    memo: "Phone purchase",
    status: "completed",
    installments: { number: 3, total: 12 },
  },
  {
    type: "normal",
    date: "2025-12-12T00:00:00.000Z",
    processedDate: "2025-12-13T00:00:00.000Z",
    chargedAmount: -5500,
    description: "Rent Transfer",
    memo: "Monthly rent Dec 2025",
    status: "completed",
  },
];

const hapoalimSavingsTxns: MockScraperTransaction[] = [
  {
    type: "normal",
    identifier: "TXN-HP-SAV-001",
    date: "2025-12-01T00:00:00.000Z",
    processedDate: "2025-12-01T00:00:00.000Z",
    chargedAmount: 5000,
    description: "Transfer from Checking",
    memo: "Auto savings",
    status: "completed",
  },
  {
    type: "normal",
    identifier: "TXN-HP-SAV-002",
    date: "2025-12-15T00:00:00.000Z",
    processedDate: "2025-12-15T00:00:00.000Z",
    chargedAmount: 12.35,
    description: "Interest Payment",
    memo: null,
    status: "completed",
  },
  {
    type: "normal",
    identifier: "TXN-HP-SAV-003",
    date: "2025-12-20T00:00:00.000Z",
    processedDate: "2025-12-20T00:00:00.000Z",
    chargedAmount: -2000,
    description: "Transfer to Checking",
    status: "completed",
  },
  {
    type: "normal",
    identifier: "TXN-HP-SAV-004",
    date: "2025-12-25T00:00:00.000Z",
    processedDate: "2025-12-25T00:00:00.000Z",
    chargedAmount: 3000,
    description: "Transfer from Checking",
    memo: "Year-end savings",
    status: "pending",
  },
  {
    type: "normal",
    identifier: "TXN-HP-SAV-005",
    date: "2025-12-28T00:00:00.000Z",
    processedDate: "2025-12-28T00:00:00.000Z",
    chargedAmount: -0.5,
    description: "Account Maintenance Fee",
    memo: null,
    status: "completed",
  },
];

export const hapoalimResponse: MockScrapeResult = {
  success: true,
  accounts: [
    {
      accountNumber: "12-345-678901",
      balance: 23450.75,
      txns: hapoalimCheckingTxns,
    },
    {
      accountNumber: "12-345-900001",
      balance: 56012.35,
      txns: hapoalimSavingsTxns,
    },
  ],
};

// ---------------------------------------------------------------------------
// Credit card provider: Max — 1 account
// ---------------------------------------------------------------------------

const maxCreditTxns: MockScraperTransaction[] = [
  {
    type: "normal",
    identifier: "TXN-MAX-001",
    date: "2025-12-02T00:00:00.000Z",
    processedDate: "2025-12-10T00:00:00.000Z",
    chargedAmount: -129.9,
    originalAmount: -129.9,
    originalCurrency: "ILS",
    description: "Castro",
    memo: "Azrieli Mall TLV",
    status: "completed",
  },
  {
    type: "installments",
    identifier: "TXN-MAX-002",
    date: "2025-12-03T00:00:00.000Z",
    processedDate: "2025-12-10T00:00:00.000Z",
    chargedAmount: -416.58,
    originalAmount: -4999.0,
    originalCurrency: "ILS",
    description: "KSP Computers",
    memo: "Laptop purchase",
    status: "completed",
    installments: { number: 1, total: 12 },
  },
  {
    type: "normal",
    identifier: "TXN-MAX-003",
    date: "2025-12-05T00:00:00.000Z",
    processedDate: "2025-12-10T00:00:00.000Z",
    chargedAmount: -35.0,
    originalAmount: -9.99,
    originalCurrency: "USD",
    description: "Netflix",
    memo: null,
    status: "completed",
  },
  {
    type: "normal",
    identifier: "TXN-MAX-004",
    date: "2025-12-06T00:00:00.000Z",
    processedDate: "2025-12-10T00:00:00.000Z",
    chargedAmount: -67.0,
    description: "Aroma TLV",
    memo: null,
    status: "pending",
  },
  {
    type: "normal",
    identifier: null,
    date: "2025-12-08T00:00:00.000Z",
    processedDate: "2025-12-10T00:00:00.000Z",
    chargedAmount: -18.9,
    description: "Alonit Gas Station",
    status: "completed",
  },
  {
    type: "installments",
    identifier: "TXN-MAX-006",
    date: "2025-12-09T00:00:00.000Z",
    processedDate: "2025-12-10T00:00:00.000Z",
    chargedAmount: -200.0,
    originalAmount: -2400.0,
    originalCurrency: "ILS",
    description: "IKEA",
    memo: "Furniture",
    status: "completed",
    installments: { number: 5, total: 12 },
  },
  {
    type: "normal",
    identifier: "TXN-MAX-007",
    date: "2025-12-10T00:00:00.000Z",
    processedDate: "2025-12-15T00:00:00.000Z",
    chargedAmount: -310.0,
    description: "Super-Pharm",
    memo: "Online order",
    status: "completed",
  },
  {
    type: "normal",
    identifier: "TXN-MAX-008",
    date: "2025-12-11T00:00:00.000Z",
    processedDate: "2025-12-15T00:00:00.000Z",
    chargedAmount: 129.9,
    description: "Castro Refund",
    memo: "Return - Azrieli Mall TLV",
    status: "completed",
  },
];

export const maxResponse: MockScrapeResult = {
  success: true,
  accounts: [
    {
      accountNumber: "4580-1234-5678-9012",
      txns: maxCreditTxns,
    },
  ],
};

// ---------------------------------------------------------------------------
// Edge-case transactions for targeted testing
// ---------------------------------------------------------------------------

export const edgeCaseTransactions: MockScraperTransaction[] = [
  // Negative amount (refund)
  {
    type: "normal",
    identifier: "EDGE-001",
    date: "2025-12-01T00:00:00.000Z",
    chargedAmount: 500,
    description: "Refund - Shufersal",
    memo: "Overcharge correction",
    status: "completed",
  },
  // Zero amount
  {
    type: "normal",
    identifier: "EDGE-002",
    date: "2025-12-02T00:00:00.000Z",
    chargedAmount: 0,
    description: "Balance Adjustment",
    memo: null,
    status: "completed",
  },
  // Missing memo (undefined, not null)
  {
    type: "normal",
    identifier: "EDGE-003",
    date: "2025-12-03T00:00:00.000Z",
    chargedAmount: -15.5,
    description: "Cofix",
    status: "completed",
  },
  // Missing identifier
  {
    type: "normal",
    date: "2025-12-04T00:00:00.000Z",
    chargedAmount: -99.0,
    description: "Unknown Merchant",
    memo: "POS terminal",
    status: "completed",
  },
  // Installment payment with large total
  {
    type: "installments",
    identifier: "EDGE-005",
    date: "2025-12-05T00:00:00.000Z",
    chargedAmount: -83.25,
    originalAmount: -999.0,
    originalCurrency: "ILS",
    description: "Elbit Systems Store",
    memo: "Employee discount",
    status: "completed",
    installments: { number: 7, total: 12 },
  },
  // Foreign currency transaction
  {
    type: "normal",
    identifier: "EDGE-006",
    date: "2025-12-06T00:00:00.000Z",
    chargedAmount: -180.0,
    originalAmount: -49.99,
    originalCurrency: "USD",
    chargedCurrency: "ILS",
    description: "Amazon.com",
    memo: "International purchase",
    status: "pending",
  },
];

// ---------------------------------------------------------------------------
// Error response
// ---------------------------------------------------------------------------

export const errorResponse: MockScrapeResult = {
  success: false,
  accounts: [],
  error: "Invalid credentials",
};
