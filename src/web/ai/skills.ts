// Skills system — discovers and loads skill markdown files that augment the agent's system prompt.
// Supports two tiers:
//   - knowledge skills: small reference material, loaded on-demand via load_skill tool
//   - mode skills: large procedural workflows from plugin/skills/, activated by user
// Default skills are bundled in src/web/ai/default-skills/ and copied to the user's
// config directory on first use.

import { readdir, readFile, copyFile, mkdir } from "node:fs/promises";
import { join, basename } from "node:path";
import envPaths from "env-paths";
import type { Skill } from "./types.js";

const paths = envPaths("kolshek");
const SKILLS_DIR = join(paths.config, "skills");
const BUNDLED_DIR = join(import.meta.dir, "default-skills");
const PLUGIN_SKILLS_DIR = join(import.meta.dir, "..", "..", "..", "plugin", "skills");

// Module-level caches populated on first discovery
let skillCache: Map<string, Skill> | null = null;
let modeCache: Map<string, Skill> | null = null;

// Parse YAML frontmatter from a skill markdown file.
// Returns the parsed fields and the body content without frontmatter.
function parseSkillFile(filename: string, raw: string): Skill {
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!fmMatch) {
    // No frontmatter — fall back to filename-derived metadata
    return {
      name: basename(filename, ".md"),
      filename,
      description: raw.split("\n")[0] || "",
      tier: "knowledge",
      content: raw,
    };
  }

  const frontmatter = fmMatch[1];
  const body = fmMatch[2].trim();

  // Simple line-based parsing (no YAML lib needed for flat fields)
  const get = (key: string): string => {
    // Handle multi-line YAML values with > or | continuation
    const multiMatch = frontmatter.match(new RegExp(`^${key}:\\s*[>|]\\s*\\n((?:\\s+.+\\n?)*)`, "m"));
    if (multiMatch) return multiMatch[1].replace(/^\s+/gm, "").trim();
    const singleMatch = frontmatter.match(new RegExp(`^${key}:\\s*["']?(.+?)["']?\\s*$`, "m"));
    return singleMatch ? singleMatch[1] : "";
  };

  const name = get("name") || basename(filename, ".md");
  const description = get("description") || body.split("\n")[0] || "";
  const tierRaw = get("tier");
  const tier = (tierRaw === "workflow" || tierRaw === "mode") ? tierRaw : "knowledge";

  return { name, filename, description, tier, content: body };
}

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

// Discover all knowledge/workflow skill files in the skills directory
export async function discoverSkills(): Promise<Skill[]> {
  await ensureSkillsDir();

  let files: string[];
  try {
    files = await readdir(SKILLS_DIR);
  } catch {
    return [];
  }

  const skills: Skill[] = [];
  const cache = new Map<string, Skill>();

  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    try {
      const raw = await readFile(join(SKILLS_DIR, file), "utf-8");
      const skill = parseSkillFile(file, raw);
      skills.push(skill);
      cache.set(skill.name, skill);
    } catch {
      // Skip unreadable files
    }
  }

  skillCache = cache;
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

// Get a cached skill by name (for the load_skill tool)
export function getSkillByName(name: string): Skill | undefined {
  return skillCache?.get(name);
}

// Get all cached skill names and descriptions (for the skill index)
export function getSkillIndex(): Array<{ name: string; description: string }> {
  if (!skillCache) return [];
  return [...skillCache.values()].map((s) => ({ name: s.name, description: s.description }));
}

// Adapt plugin skill content for dashboard context.
// Bridges tool naming: kolshek CLI → dashboard run_command/query tools.
function adaptForDashboard(content: string): string {
  let adapted = content;
  // Replace "kolshek query "..." --json" with query tool instructions
  adapted = adapted.replace(
    /`kolshek\s+query\s+"([^"]+)"\s+--json`/g,
    'the `query` tool with sql: `$1`',
  );
  // Replace "kolshek <cmd> --json" with run_command tool instructions
  adapted = adapted.replace(
    /`kolshek\s+([^`]+?)\s+--json`/g,
    'the `run_command` tool with command: `$1`',
  );
  // Replace references to cli-reference.md with load_skill
  adapted = adapted.replace(
    /Read `references\/cli-reference\.md`[^\n]*/g,
    'Load the "cli-reference" skill using `load_skill` if you need command details.',
  );
  // Replace bun envPaths resolution with read_file/write_file
  adapted = adapted.replace(
    /```\nbun -e "import envPaths[^`]*```/g,
    "Use the `read_file` and `write_file` tools for config directory files (e.g. budget.toml).",
  );
  // Replace "Resolve config dir" blocks
  adapted = adapted.replace(
    /\*\*Resolve config dir\*\*[^]*?Store this path[^\n]*/g,
    "The config directory is accessible via `read_file` and `write_file` tools.",
  );
  return adapted;
}

// Discover mode skills from plugin/skills/*/SKILL.md
export async function discoverModeSkills(): Promise<Skill[]> {
  let dirs: string[];
  try {
    dirs = await readdir(PLUGIN_SKILLS_DIR);
  } catch {
    return [];
  }

  const skills: Skill[] = [];
  const cache = new Map<string, Skill>();

  for (const dir of dirs) {
    const skillFile = join(PLUGIN_SKILLS_DIR, dir, "SKILL.md");
    try {
      const raw = await readFile(skillFile, "utf-8");
      const skill = parseSkillFile(`${dir}/SKILL.md`, raw);
      skill.tier = "mode";
      skill.content = adaptForDashboard(skill.content);
      skills.push(skill);
      cache.set(skill.name, skill);
    } catch {
      // Skip directories without SKILL.md
    }
  }

  // Also register cli-reference.md as a loadable reference
  try {
    const refPath = join(PLUGIN_SKILLS_DIR, "..", "references", "cli-reference.md");
    const raw = await readFile(refPath, "utf-8");
    const refSkill: Skill = {
      name: "cli-reference",
      filename: "cli-reference.md",
      description: "Complete KolShek CLI command reference — flags, exit codes, DB schema, SQL patterns.",
      tier: "knowledge",
      content: raw,
    };
    // Add to the knowledge skill cache so load_skill can find it
    if (skillCache) {
      skillCache.set(refSkill.name, refSkill);
    }
  } catch {
    // Reference file may not exist
  }

  modeCache = cache;
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

// Get a cached mode skill by name
export function getModeByName(name: string): Skill | undefined {
  return modeCache?.get(name);
}

// Get all available modes (name + description)
export function getModeIndex(): Array<{ name: string; description: string }> {
  if (!modeCache) return [];
  return [...modeCache.values()].map((s) => ({ name: s.name, description: s.description }));
}

// Build the system prompt, scaled by model tier.
// Tier 1-2 (small): compact prompt, inline schema, no skills index.
// Tier 3-4 (large): full prompt with schema, guidelines, skills index.
export function buildSystemPrompt(
  skills: Skill[],
  enabledSkillNames?: string[],
  activeMode?: string,
  modeContent?: string,
  modelTier: number = 1,
  thinking: boolean = false,
): string {
  const today = new Date().toISOString().slice(0, 10);

  let systemPrompt: string;

  if (modelTier >= 3) {
    // Large models (24B+) — full system prompt with guidelines
    systemPrompt = `You are a personal finance assistant for KolShek (כל שקל), an Israeli finance tracking tool.
You have tools that access the user's local SQLite database containing bank and credit card transactions from Israeli financial institutions. When a tool returns results, that is the user's real data — use it to answer. Never say you cannot access their data.
Today: ${today}. Currency: ILS (₪). Negative amounts = expenses, positive = income.
Always respond in English unless the user writes in Hebrew.

## Database Schema
providers(id PK, company_id, alias UNIQUE, display_name, type bank|credit_card, last_synced_at, created_at)
accounts(id PK, provider_id→providers, account_number, display_name, balance, currency='ILS', created_at)
transactions(id PK, account_id→accounts, type normal|installments, identifier, date, processed_date, original_amount, original_currency, charged_amount, charged_currency, description, description_en, memo, status completed|pending, installment_number, installment_total, category, hash, unique_id, created_at, updated_at)
categories(name PK, classification='expense', created_at)
category_rules(id PK, category, conditions JSON, priority=0, created_at)
translation_rules(id PK, english_name, match_pattern, created_at)
sync_log(id PK, provider_id→providers, started_at, completed_at, status, transactions_added, transactions_updated, error_message)
spending_excludes(category PK, created_at)

Key joins: transactions.account_id → accounts.id → accounts.provider_id → providers.id
Uncategorized: category IS NULL OR category = '' OR category = 'uncategorized' — always check all three.

## Guidelines
- Format currency as ₪X,XXX
- Use tables for comparative data
- Be concise but thorough — show data, not just conclusions
- When creating rules or modifying data, show the user what you're doing and confirm the result`;

    // Skills index for large models
    const activeSkills = enabledSkillNames
      ? skills.filter((s) => enabledSkillNames.includes(s.name))
      : skills;
    if (activeSkills.length > 0) {
      systemPrompt += "\n\n## Available Skills\nUse the `load_skill` tool to load detailed domain knowledge when needed.\n";
      for (const skill of activeSkills) {
        systemPrompt += `- **${skill.name}**: ${skill.description}\n`;
      }
    }
  } else {
    // Small models (4-12B) — compact prompt, /no_think unless user enables thinking.
    // Schema and commands are in the tool descriptions — not here — so context
    // is co-located with where the model looks when calling tools.
    systemPrompt = `${thinking ? "" : "/no_think\n"}You are a finance assistant. Today: ${today}. Currency: ILS (₪). Respond in English unless user writes Hebrew. Be brief.
Your tools access the user's LOCAL database with real data. ALWAYS use tool results to answer. NEVER say you cannot access their data. Format currency as ₪X,XXX.`;
  }

  // Inject active mode content
  if (activeMode && modeContent) {
    systemPrompt += modelTier >= 3
      ? `\n\n## Active Mode: ${activeMode}\nFollow the steps below carefully, using the available tools.\n\n${modeContent}`
      : `\n\nMode: ${activeMode}\n${modeContent}`;
  }

  return systemPrompt;
}
