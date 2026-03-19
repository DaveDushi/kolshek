// Skills system — discovers and loads skill markdown files that augment the agent's system prompt.
// Default skills are bundled in src/web/ai/default-skills/ and copied to the user's
// config directory on first use.

import { readdir, readFile, copyFile, mkdir } from "node:fs/promises";
import { join, basename } from "node:path";
import envPaths from "env-paths";
import type { Skill } from "./types.js";

const paths = envPaths("kolshek");
const SKILLS_DIR = join(paths.config, "skills");
const BUNDLED_DIR = join(import.meta.dir, "default-skills");

// Ensure the skills directory exists and seed defaults
async function ensureSkillsDir(): Promise<void> {
  await mkdir(SKILLS_DIR, { recursive: true });

  // Copy bundled defaults if they don't exist yet
  try {
    const bundled = await readdir(BUNDLED_DIR);
    for (const file of bundled) {
      if (!file.endsWith(".md")) continue;
      const dest = join(SKILLS_DIR, file);
      const destFile = Bun.file(dest);
      if (!(await destFile.exists())) {
        await copyFile(join(BUNDLED_DIR, file), dest);
      }
    }
  } catch {
    // Bundled dir may not exist in some builds — that's OK
  }
}

// Discover all skill files in the skills directory
export async function discoverSkills(): Promise<Skill[]> {
  await ensureSkillsDir();

  let files: string[];
  try {
    files = await readdir(SKILLS_DIR);
  } catch {
    return [];
  }

  const skills: Skill[] = [];
  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    const name = basename(file, ".md");
    try {
      const content = await readFile(join(SKILLS_DIR, file), "utf-8");
      skills.push({ name, filename: file, content });
    } catch {
      // Skip unreadable files
    }
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

// Build the full system prompt from base prompt + enabled skills
export function buildSystemPrompt(skills: Skill[], enabledSkillNames?: string[]): string {
  const today = new Date().toISOString().slice(0, 10);

  let systemPrompt = `You are a personal finance assistant for KolShek (כל שקל), an Israeli finance tracking tool.
You have access to the user's local SQLite database containing bank and credit card transactions from Israeli financial institutions.

## Key Facts
- Today's date: ${today}
- Currency: ILS (Israeli New Shekel, ₪) unless stated otherwise
- Transaction amounts: negative = expense, positive = income
- Descriptions may be in Hebrew — the description_en field has English translations when available
- Use the get_schema tool first if you need to understand the database structure
- Use the query tool for flexible SQL queries, or the convenience tools (monthly_report, category_report, search_transactions, list_accounts) for common operations

## Response Guidelines
- Always respond in the user's language (detect from their message)
- Format currency as ₪X,XXX (no decimals for round amounts)
- Use tables for comparative data
- Be concise but thorough — show your data, not just conclusions
- When presenting financial data, always clarify the time period
- If a query returns no results, explain what that means rather than just saying "no data"`;

  // Filter skills
  const activeSkills = enabledSkillNames
    ? skills.filter((s) => enabledSkillNames.includes(s.name))
    : skills;

  if (activeSkills.length > 0) {
    systemPrompt += "\n\n## Domain Knowledge\n";
    for (const skill of activeSkills) {
      systemPrompt += `\n### ${skill.name}\n${skill.content}\n`;
    }
  }

  return systemPrompt;
}
