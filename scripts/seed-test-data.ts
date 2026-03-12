/**
 * Seed script — populates the DB with realistic test data.
 *
 * Usage: bun run scripts/seed-test-data.ts [--clear]
 *
 * Creates:
 *   - 1 bank provider (Bank Hapoalim) with 1 checking account
 *   - 1 credit card provider (Max) with 1 card
 *   - ~60 transactions across the last 3 months
 *   - 1 sync log entry per provider
 *   - A few category and translation rules
 */

import { ensureDirectories, getDbPath } from "../src/config/loader.js";
import { initDatabase, getDatabase } from "../src/db/database.js";
import { createProvider } from "../src/db/repositories/providers.js";
import { upsertAccount } from "../src/db/repositories/accounts.js";
import { upsertTransaction } from "../src/db/repositories/transactions.js";
import { createSyncLog, completeSyncLog } from "../src/db/repositories/sync-log.js";
import { addCategoryRule } from "../src/db/repositories/categories.js";
import { addTranslationRule } from "../src/db/repositories/translations.js";
import { formatISO, subDays } from "date-fns";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dateStr(daysAgo: number): string {
  return formatISO(subDays(new Date(), daysAgo), { representation: "date" });
}

function hash(parts: (string | number)[]): string {
  return parts.map((p) => String(p).trim()).join("_");
}

let txCounter = 0;
function makeTx(
  accountId: number,
  companyId: string,
  accountNumber: string,
  daysAgo: number,
  amount: number,
  description: string,
  opts: {
    memo?: string;
    status?: "completed" | "pending";
    type?: "normal" | "installments";
    installmentNumber?: number;
    installmentTotal?: number;
    originalCurrency?: string;
    originalAmount?: number;
    category?: string;
    descriptionEn?: string;
  } = {},
) {
  txCounter++;
  const date = dateStr(daysAgo);
  const processedDate = dateStr(Math.max(0, daysAgo - 2));
  const h = hash([date, amount, description, opts.memo ?? "", companyId, accountNumber]);
  const uid = hash([date, companyId, accountNumber, amount, `${description}_${opts.memo ?? ""}`]);

  upsertTransaction({
    accountId,
    type: opts.type ?? "normal",
    date,
    processedDate,
    originalAmount: opts.originalAmount ?? amount,
    originalCurrency: opts.originalCurrency ?? "ILS",
    chargedAmount: amount,
    chargedCurrency: "ILS",
    description,
    descriptionEn: opts.descriptionEn ?? null,
    memo: opts.memo ?? null,
    status: opts.status ?? "completed",
    installmentNumber: opts.installmentNumber ?? null,
    installmentTotal: opts.installmentTotal ?? null,
    category: opts.category ?? null,
    hash: h,
    uniqueId: uid,
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const clearFirst = process.argv.includes("--clear");

await ensureDirectories();
initDatabase(getDbPath());

if (clearFirst) {
  const db = getDatabase();
  db.run("DELETE FROM transactions");
  db.run("DELETE FROM accounts");
  db.run("DELETE FROM sync_log");
  db.run("DELETE FROM providers");
  db.run("DELETE FROM category_rules");
  db.run("DELETE FROM translation_rules");
  console.log("Cleared existing data.");
}

// --- Providers ---
const bank = createProvider("hapoalim", "Bank Hapoalim", "bank", "hapoalim");
const cc = createProvider("max", "Max", "credit_card", "max");
console.log(`Created providers: ${bank.displayName} (ID ${bank.id}), ${cc.displayName} (ID ${cc.id})`);

// --- Accounts ---
const checking = upsertAccount(bank.id, "12-345-678901", 24350.75);
const card = upsertAccount(cc.id, "5326-****-****-7890", -3280.50);
console.log(`Created accounts: checking (ID ${checking.id}), card (ID ${card.id})`);

// --- Bank transactions (salary, rent, utilities, transfers) ---
// Salary
makeTx(checking.id, "hapoalim", checking.accountNumber, 60, 18500, "משכורת חודשית", {
  memo: "העברת שכר",
  descriptionEn: "Monthly Salary",
  category: "Income",
});
makeTx(checking.id, "hapoalim", checking.accountNumber, 30, 18500, "משכורת חודשית", {
  memo: "העברת שכר",
  descriptionEn: "Monthly Salary",
  category: "Income",
});
makeTx(checking.id, "hapoalim", checking.accountNumber, 1, 18500, "משכורת חודשית", {
  memo: "העברת שכר",
  descriptionEn: "Monthly Salary",
  category: "Income",
});

// Rent
makeTx(checking.id, "hapoalim", checking.accountNumber, 58, -4500, "הו״ק שכר דירה", {
  descriptionEn: "Rent",
  category: "Housing",
});
makeTx(checking.id, "hapoalim", checking.accountNumber, 28, -4500, "הו״ק שכר דירה", {
  descriptionEn: "Rent",
  category: "Housing",
});

// Utilities
makeTx(checking.id, "hapoalim", checking.accountNumber, 45, -320, "חברת חשמל", {
  descriptionEn: "Electric Company",
  category: "Utilities",
});
makeTx(checking.id, "hapoalim", checking.accountNumber, 15, -345, "חברת חשמל", {
  descriptionEn: "Electric Company",
  category: "Utilities",
});
makeTx(checking.id, "hapoalim", checking.accountNumber, 40, -89.90, "מי גבעתיים", {
  descriptionEn: "Water Bill",
  category: "Utilities",
});

// Internet & phone
makeTx(checking.id, "hapoalim", checking.accountNumber, 35, -119.90, "פרטנר תקשורת", {
  descriptionEn: "Partner Communications",
  category: "Telecom",
});
makeTx(checking.id, "hapoalim", checking.accountNumber, 5, -119.90, "פרטנר תקשורת", {
  descriptionEn: "Partner Communications",
  category: "Telecom",
});

// Arnona (municipal tax)
makeTx(checking.id, "hapoalim", checking.accountNumber, 50, -650, "עיריית תל אביב ארנונה", {
  descriptionEn: "Tel Aviv Municipality - Arnona",
  category: "Housing",
});

// ATM withdrawal
makeTx(checking.id, "hapoalim", checking.accountNumber, 22, -500, "משיכת כספומט", {
  memo: "סניף דיזנגוף",
  descriptionEn: "ATM Withdrawal",
  category: "Cash",
});

// Transfer out
makeTx(checking.id, "hapoalim", checking.accountNumber, 10, -1200, "העברה בנקאית", {
  memo: "להורים",
  descriptionEn: "Bank Transfer",
  category: "Transfers",
});

// Bank fees
makeTx(checking.id, "hapoalim", checking.accountNumber, 3, -29.90, "עמלת ניהול חשבון", {
  descriptionEn: "Account Management Fee",
  category: "Fees",
});

// Pending bank transaction
makeTx(checking.id, "hapoalim", checking.accountNumber, 0, -200, "ביט - העברה", {
  memo: "Bit payment",
  descriptionEn: "Bit Transfer",
  status: "pending",
});

// --- Credit card transactions (shopping, food, gas, subscriptions) ---
// Supermarkets
makeTx(card.id, "max", card.accountNumber, 55, -287.40, "שופרסל דיזנגוף סנטר", {
  descriptionEn: "Shufersal Dizengoff Center",
  category: "Groceries",
});
makeTx(card.id, "max", card.accountNumber, 48, -195.80, "רמי לוי - ת״א", {
  descriptionEn: "Rami Levy - Tel Aviv",
  category: "Groceries",
});
makeTx(card.id, "max", card.accountNumber, 41, -312.60, "שופרסל דיזנגוף סנטר", {
  descriptionEn: "Shufersal Dizengoff Center",
  category: "Groceries",
});
makeTx(card.id, "max", card.accountNumber, 34, -145.90, "יינות ביתן", {
  descriptionEn: "Yeinot Bitan",
  category: "Groceries",
});
makeTx(card.id, "max", card.accountNumber, 20, -267.30, "שופרסל דיזנגוף סנטר", {
  descriptionEn: "Shufersal Dizengoff Center",
  category: "Groceries",
});
makeTx(card.id, "max", card.accountNumber, 12, -198.50, "רמי לוי - ת״א", {
  descriptionEn: "Rami Levy - Tel Aviv",
  category: "Groceries",
});
makeTx(card.id, "max", card.accountNumber, 5, -340.20, "שופרסל דיזנגוף סנטר", {
  descriptionEn: "Shufersal Dizengoff Center",
  category: "Groceries",
});

// Restaurants & cafes
makeTx(card.id, "max", card.accountNumber, 52, -89, "קפה לנדוור רוטשילד", {
  descriptionEn: "Cafe Landwer Rothschild",
  category: "Dining",
});
makeTx(card.id, "max", card.accountNumber, 43, -156, "שיפודי התקווה", {
  descriptionEn: "Shipudei Hatikva",
  category: "Dining",
});
makeTx(card.id, "max", card.accountNumber, 38, -42, "ארומה תל אביב", {
  descriptionEn: "Aroma Tel Aviv",
  category: "Dining",
});
makeTx(card.id, "max", card.accountNumber, 25, -210, "פיצה שמש", {
  descriptionEn: "Pizza Shemesh",
  category: "Dining",
});
makeTx(card.id, "max", card.accountNumber, 14, -68, "קפה גרג יפו", {
  descriptionEn: "Cafe Greg Jaffa",
  category: "Dining",
});
makeTx(card.id, "max", card.accountNumber, 7, -135, "משלוח וולט", {
  descriptionEn: "Wolt Delivery",
  category: "Dining",
});
makeTx(card.id, "max", card.accountNumber, 2, -52, "ארומה תל אביב", {
  descriptionEn: "Aroma Tel Aviv",
  category: "Dining",
});

// Gas
makeTx(card.id, "max", card.accountNumber, 50, -280, "פז - ת״א דרום", {
  descriptionEn: "Paz Gas Station",
  category: "Transportation",
});
makeTx(card.id, "max", card.accountNumber, 30, -310.50, "סונול - אבן גבירול", {
  descriptionEn: "Sonol Gas Station",
  category: "Transportation",
});
makeTx(card.id, "max", card.accountNumber, 8, -295, "פז - ת״א דרום", {
  descriptionEn: "Paz Gas Station",
  category: "Transportation",
});

// Subscriptions
makeTx(card.id, "max", card.accountNumber, 45, -49.90, "נטפליקס", {
  descriptionEn: "Netflix",
  category: "Entertainment",
});
makeTx(card.id, "max", card.accountNumber, 44, -25.90, "ספוטיפיי", {
  descriptionEn: "Spotify",
  category: "Entertainment",
});
makeTx(card.id, "max", card.accountNumber, 15, -49.90, "נטפליקס", {
  descriptionEn: "Netflix",
  category: "Entertainment",
});
makeTx(card.id, "max", card.accountNumber, 14, -25.90, "ספוטיפיי", {
  descriptionEn: "Spotify",
  category: "Entertainment",
});

// Shopping
makeTx(card.id, "max", card.accountNumber, 36, -459, "זארה עזריאלי", {
  descriptionEn: "Zara Azrieli",
  category: "Shopping",
});
makeTx(card.id, "max", card.accountNumber, 18, -189, "אמזון - רכישה בינלאומית", {
  descriptionEn: "Amazon International",
  category: "Shopping",
  originalCurrency: "USD",
  originalAmount: -52.99,
});

// Installment purchase
makeTx(card.id, "max", card.accountNumber, 42, -333.33, "איקאה - ראשל״צ", {
  descriptionEn: "IKEA Rishon LeZion",
  category: "Home",
  type: "installments",
  installmentNumber: 1,
  installmentTotal: 3,
  memo: "תשלום 1 מתוך 3 - ₪999.99",
});
makeTx(card.id, "max", card.accountNumber, 12, -333.33, "איקאה - ראשל״צ", {
  descriptionEn: "IKEA Rishon LeZion",
  category: "Home",
  type: "installments",
  installmentNumber: 2,
  installmentTotal: 3,
  memo: "תשלום 2 מתוך 3 - ₪999.99",
});

// Health
makeTx(card.id, "max", card.accountNumber, 27, -120, "סופר-פארם דיזנגוף", {
  descriptionEn: "Super-Pharm Dizengoff",
  category: "Health",
});

// Pending CC transactions
makeTx(card.id, "max", card.accountNumber, 1, -78, "קפה גרג יפו", {
  descriptionEn: "Cafe Greg Jaffa",
  status: "pending",
});
makeTx(card.id, "max", card.accountNumber, 0, -425.60, "שופרסל דיזנגוף סנטר", {
  descriptionEn: "Shufersal Dizengoff Center",
  status: "pending",
});

console.log(`Inserted ${txCounter} transactions.`);

// --- Sync logs ---
const today = dateStr(0);
const threeMonthsAgo = dateStr(90);

const bankSync = createSyncLog(bank.id, threeMonthsAgo, today);
completeSyncLog(bankSync.id, "success", 15, 0);

const ccSync = createSyncLog(cc.id, threeMonthsAgo, today);
completeSyncLog(ccSync.id, "success", txCounter - 15, 0);

// Update last synced on providers
const db = getDatabase();
db.prepare("UPDATE providers SET last_synced_at = $now WHERE id = $id")
  .run({ $id: bank.id, $now: new Date().toISOString() });
db.prepare("UPDATE providers SET last_synced_at = $now WHERE id = $id")
  .run({ $id: cc.id, $now: new Date().toISOString() });

console.log("Created sync log entries.");

// --- Category rules ---
addCategoryRule("Groceries", "%שופרסל%");
addCategoryRule("Groceries", "%רמי לוי%");
addCategoryRule("Groceries", "%יינות ביתן%");
addCategoryRule("Dining", "%קפה%");
addCategoryRule("Dining", "%ארומה%");
addCategoryRule("Dining", "%וולט%");
addCategoryRule("Transportation", "%פז%");
addCategoryRule("Transportation", "%סונול%");
addCategoryRule("Entertainment", "%נטפליקס%");
addCategoryRule("Entertainment", "%ספוטיפיי%");
addCategoryRule("Income", "%משכורת%");
addCategoryRule("Housing", "%שכר דירה%");
addCategoryRule("Housing", "%ארנונה%");
addCategoryRule("Utilities", "%חשמל%");
console.log("Created category rules.");

// --- Translation rules ---
addTranslationRule("Shufersal", "%שופרסל%");
addTranslationRule("Rami Levy", "%רמי לוי%");
addTranslationRule("Netflix", "%נטפליקס%");
addTranslationRule("Spotify", "%ספוטיפיי%");
addTranslationRule("Aroma", "%ארומה%");
addTranslationRule("Electric Company", "%חברת חשמל%");
addTranslationRule("Partner Communications", "%פרטנר%");
console.log("Created translation rules.");

console.log("\nDone! Test data ready. Try:");
console.log("  bun run dev -- providers list");
console.log("  bun run dev -- transactions list");
console.log("  bun run dev -- transactions list --from 30d");
console.log("  bun run dev -- reports monthly");
console.log("  bun run dev -- reports categories");
