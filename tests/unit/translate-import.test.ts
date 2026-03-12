import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { initDatabase, closeDatabase } from "../../src/db/database.js";
import {
  bulkImportTranslationRules,
  listTranslationRules,
} from "../../src/db/repositories/translations.js";

beforeAll(() => {
  initDatabase(":memory:");
});

afterAll(() => {
  closeDatabase();
});

describe("bulkImportTranslationRules", () => {
  it("imports an array of rules", () => {
    const result = bulkImportTranslationRules([
      { englishName: "Shufersal", matchPattern: "שופרסל" },
      { englishName: "Rami Levy", matchPattern: "רמי לוי" },
    ]);
    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(0);
  });

  it("skips duplicates by matchPattern", () => {
    const result = bulkImportTranslationRules([
      { englishName: "Shufersal", matchPattern: "שופרסל" },
      { englishName: "New Entry", matchPattern: "חדש" },
    ]);
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it("handles apostrophes in englishName", () => {
    const result = bulkImportTranslationRules([
      { englishName: "Ouri's Market", matchPattern: "אורי מרקט" },
    ]);
    expect(result.imported).toBe(1);
    const rules = listTranslationRules();
    const match = rules.find((r) => r.matchPattern === "אורי מרקט");
    expect(match?.englishName).toBe("Ouri's Market");
  });

  it("handles quotes and special punctuation", () => {
    const result = bulkImportTranslationRules([
      { englishName: "Ben & Jerry's", matchPattern: "בן אנד ג׳ריס" },
    ]);
    expect(result.imported).toBe(1);
    const rules = listTranslationRules();
    const match = rules.find((r) => r.matchPattern === "בן אנד ג׳ריס");
    expect(match?.englishName).toBe("Ben & Jerry's");
  });

  it("handles empty array", () => {
    const result = bulkImportTranslationRules([]);
    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(0);
  });
});
