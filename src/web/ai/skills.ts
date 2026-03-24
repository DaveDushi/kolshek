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

// Build the full system prompt from base prompt + skill index + optional active mode.
// Kept deliberately compact — every token costs inference time on local models.
export function buildSystemPrompt(
  skills: Skill[],
  enabledSkillNames?: string[],
  activeMode?: string,
  modeContent?: string,
): string {
  const today = new Date().toISOString().slice(0, 10);

  // Compact system prompt — DB schema is available via load_skill, not inlined.
  // /no_think disables Qwen 3.5's internal reasoning mode which wastes thousands of tokens.
  let systemPrompt = `/no_think
You are a concise Israeli finance assistant (KolShek). Today: ${today}. Currency: ILS (₪). Negative=expense, positive=income.
Use query tool for SQL, run_command for writes. Respond in the user's language. Be brief.`;

  // Build skill index (progressive disclosure — descriptions only, not full content)
  const activeSkills = enabledSkillNames
    ? skills.filter((s) => enabledSkillNames.includes(s.name))
    : skills;

  if (activeSkills.length > 0) {
    systemPrompt += "\nSkills (load with load_skill tool):";
    for (const skill of activeSkills) {
      systemPrompt += ` ${skill.name},`;
    }
  }

  // Inject active mode content into system prompt
  if (activeMode && modeContent) {
    systemPrompt += `\n\nMode: ${activeMode}\n${modeContent}`;
  }

  return systemPrompt;
}
