/**
 * Hebrew→English merchant name dictionary for Israeli transactions.
 *
 * Keys are Hebrew substrings matched against transaction descriptions.
 * Longer keys are checked first so "שופרסל דיל" matches before "שופרסל".
 */

export const MERCHANT_NAMES: Record<string, string> = {
  // Supermarkets & grocery
  "שופרסל דיל": "Shufersal Deal",
  "שופרסל שלי": "Shufersal Sheli",
  "שופרסל אונליין": "Shufersal Online",
  "שופרסל": "Shufersal",
  "רמי לוי": "Rami Levy",
  "מגה": "Mega",
  "יוחננוף": "Yochananof",
  "ויקטורי": "Victory",
  "אושר עד": "Osher Ad",
  "חצי חינם": "Hatzi Hinam",
  "יינות ביתן": "Yeinot Bitan",
  "טיב טעם": "Tiv Taam",
  "קרפור": "Carrefour",
  "פרש מרקט": "Fresh Market",
  "סופר פארם": "Super-Pharm",
  "AM:PM": "AM:PM",

  // Gas stations
  "פז": "Paz",
  "סונול": "Sonol",
  "דלק": "Delek",
  "דור אלון": "Dor Alon",
  "טן בר": "Ten Bar",

  // Telecom
  "פלאפון": "Pelephone",
  "סלקום": "Cellcom",
  "פרטנר": "Partner",
  "הוט מובייל": "Hot Mobile",
  "הוט": "Hot",
  "בזק": "Bezeq",
  "גולן טלקום": "Golan Telecom",
  "012": "012",
  "אקספון": "Exphone",

  // Restaurants & food chains
  "מקדונלדס": "McDonald's",
  "ברגר קינג": "Burger King",
  "דומינוס": "Domino's",
  "פיצה האט": "Pizza Hut",
  "ארומה": "Aroma",
  "קפה קפה": "Cafe Cafe",
  "גרג": "Greg",
  "לנדוור": "Landwer",
  "רולדין": "Roladin",
  "שיפודי התקווה": "Shipudei HaTikva",
  "KFC": "KFC",
  "בורגרס בר": "Burgers Bar",
  "מוזס": "Moses",
  "BBB": "BBB",
  "קופי בין": "Cofix",
  "קופיקס": "Cofix",

  // Retail & fashion
  "איקאה": "IKEA",
  "המשביר": "Hamashbir",
  "פוקס": "Fox",
  "גולף": "Golf",
  "קסטרו": "Castro",
  "רנואר": "Renuar",
  "H&M": "H&M",
  "זארה": "Zara",
  "דלתא": "Delta",
  "נעלי סקופ": "Scoop Shoes",
  "ACE": "ACE Hardware",

  // Electronics
  "באג": "Bug",
  "מחסני חשמל": "Mahsanei Hashmal",
  "KSP": "KSP",
  "עמינח": "Aminach",
  "איי דיגיטל": "iDigital",

  // Transport & transit
  "רב קו": "Rav-Kav",
  "רכבת ישראל": "Israel Railways",
  "דן": "Dan",
  "אגד": "Egged",
  "מטרופולין": "Metropoline",
  "גט טקסי": "Gett",
  "יאנגו": "Yango",

  // Utilities & government
  "חברת חשמל": "Israel Electric Corp",
  "מקורות": "Mekorot",
  "עיריית": "Municipality of",
  "ביטוח לאומי": "Bituach Leumi",
  "מס הכנסה": "Israel Tax Authority",

  // Health
  "כללית": "Clalit",
  "מכבי": "Maccabi",
  "מאוחדת": "Meuhedet",
  "לאומית": "Leumit",

  // Online services
  "אמזון": "Amazon",
  "נטפליקס": "Netflix",
  "ספוטיפיי": "Spotify",
  "אפל": "Apple",
  "גוגל": "Google",
  "פייפאל": "PayPal",
  "עלי אקספרס": "AliExpress",
  "אלי אקספרס": "AliExpress",

  // Insurance
  "הראל": "Harel",
  "מגדל": "Migdal",
  "כלל ביטוח": "Clal Insurance",
  "הפניקס": "The Phoenix",
  "מנורה": "Menora",

  // Banks (for fee descriptions)
  "בנק הפועלים": "Bank Hapoalim",
  "בנק לאומי": "Bank Leumi",
  "בנק דיסקונט": "Bank Discount",
  "בנק מזרחי": "Bank Mizrahi",
  "בנק הבינלאומי": "First International Bank",
};

// Pre-sort keys by length descending so longer (more specific) matches win.
const sortedKeys = Object.keys(MERCHANT_NAMES).sort(
  (a, b) => b.length - a.length,
);

/**
 * Translate a Hebrew transaction description to English using substring matching.
 * Returns the English merchant name if found, or null if no match.
 */
export function translateDescription(hebrew: string): string | null {
  if (!hebrew) return null;
  for (const key of sortedKeys) {
    if (hebrew.includes(key)) {
      return MERCHANT_NAMES[key];
    }
  }
  return null;
}
