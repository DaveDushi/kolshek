/**
 * kolshek plugin — Install AI agent integrations for various tools.
 *
 * Supports: Claude Code, OpenCode, Codex, OpenClaw
 */

import type { Command } from "commander";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import {
  isJsonMode,
  printJson,
  jsonSuccess,
  jsonError,
  printError,
  info,
  success,
  warn,
  ExitCode,
} from "../output.js";
import { PLUGIN_FILES, type PluginBundle } from "../plugin-files.js";

const SUPPORTED_TOOLS = [
  "claude-code",
  "opencode",
  "codex",
  "openclaw",
] as const;

type Tool = (typeof SUPPORTED_TOOLS)[number];

function getInstallTarget(tool: Tool): { dir: string; description: string } {
  const home = homedir();
  switch (tool) {
    case "claude-code":
      return {
        dir: join(home, ".claude", "plugins", "kolshek"),
        description: "Claude Code plugin",
      };
    case "opencode":
      return {
        dir: join(process.cwd(), ".opencode"),
        description: "OpenCode skills (project-scoped)",
      };
    case "codex":
      return {
        dir: join(home, ".codex", "skills"),
        description: "Codex skills",
      };
    case "openclaw":
      return {
        dir: join(homedir(), ".openclaw", "workspace", "skills"),
        description: "OpenClaw skills",
      };
  }
}

function writeFiles(
  files: { [path: string]: string },
  targetDir: string,
): number {
  let count = 0;
  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = join(targetDir, relativePath);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content, "utf-8");
    count++;
  }
  return count;
}

const MARKETPLACE_NAME = "kolshek-local";

// Write a marketplace.json wrapper so Claude Code discovers the plugin
// via the extraKnownMarketplaces + enabledPlugins settings mechanism.
function writeMarketplaceManifest(marketplaceDir: string): void {
  const manifest = {
    name: MARKETPLACE_NAME,
    owner: { name: "KolShek" },
    plugins: [
      {
        name: "kolshek",
        source: "./kolshek",
        description: "KolShek — Israeli finance CLI plugin for Claude Code",
      },
    ],
  };
  const manifestPath = join(marketplaceDir, ".claude-plugin", "marketplace.json");
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
}

// Register the plugin in ~/.claude/settings.json so it auto-loads.
// Merges extraKnownMarketplaces + enabledPlugins without clobbering
// other settings. Returns a status message for display.
export function registerClaudeCodePlugin(
  marketplaceDir: string,
): { ok: boolean; message: string } {
  const claudeDir = join(homedir(), ".claude");
  const settingsPath = join(claudeDir, "settings.json");

  if (!existsSync(claudeDir)) {
    mkdirSync(claudeDir, { recursive: true });
  }

  let settings: Record<string, unknown> = {};
  if (existsSync(settingsPath)) {
    try {
      settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
    } catch {
      return {
        ok: false,
        message: `Could not parse ${settingsPath} — add plugin settings manually.`,
      };
    }
  }

  // Merge extraKnownMarketplaces
  const markets = (settings.extraKnownMarketplaces ?? {}) as Record<string, unknown>;
  markets[MARKETPLACE_NAME] = {
    source: {
      source: "directory",
      path: marketplaceDir.replace(/\\/g, "/"),
    },
  };
  settings.extraKnownMarketplaces = markets;

  // Merge enabledPlugins
  const enabled = (settings.enabledPlugins ?? {}) as Record<string, boolean>;
  enabled[`kolshek@${MARKETPLACE_NAME}`] = true;
  settings.enabledPlugins = enabled;

  try {
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf-8");
    return { ok: true, message: "Registered KolShek plugin in Claude Code settings." };
  } catch (err) {
    return {
      ok: false,
      message: `Could not write ${settingsPath}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export function installPlugin(
  tool: string,
  pluginFiles?: PluginBundle,
): {
  success: boolean;
  count: number;
  dir: string;
  description: string;
} {
  const bundle = pluginFiles ?? PLUGIN_FILES;
  const files = bundle[tool];
  if (!files || Object.keys(files).length === 0) {
    return { success: false, count: 0, dir: "", description: "" };
  }

  const target = getInstallTarget(tool as Tool);

  // For claude-code, nest plugin files inside a marketplace wrapper
  const writeDir = tool === "claude-code"
    ? join(target.dir, "kolshek")
    : target.dir;
  const count = writeFiles(files, writeDir);

  if (tool === "claude-code") {
    writeMarketplaceManifest(target.dir);
  }

  return { success: true, count, dir: target.dir, description: target.description };
}

export function registerPluginCommand(program: Command): void {
  const plugin = program
    .command("plugin")
    .description("Manage AI agent integrations");

  plugin
    .command("install <tool>")
    .description(
      `Install AI plugin for a tool (${SUPPORTED_TOOLS.join(", ")})`,
    )
    .action(async (tool: string) => {
      if (!SUPPORTED_TOOLS.includes(tool as Tool)) {
        if (isJsonMode()) {
          printJson(
            jsonError(
              "BAD_ARGS",
              `Unknown tool "${tool}". Supported: ${SUPPORTED_TOOLS.join(", ")}`,
              { suggestions: [`Try: kolshek plugin install ${SUPPORTED_TOOLS[0]}`] },
            ),
          );
        } else {
          printError(
            "BAD_ARGS",
            `Unknown tool "${tool}". Supported tools:\n${SUPPORTED_TOOLS.map((t) => `  - ${t}`).join("\n")}`,
          );
        }
        process.exit(ExitCode.BadArgs);
      }

      const result = installPlugin(tool);

      if (!result.success) {
        if (isJsonMode()) {
          printJson(
            jsonError("NOT_FOUND", `No plugin files found for "${tool}"`),
          );
        } else {
          printError("NOT_FOUND", `No plugin files found for "${tool}".`);
        }
        process.exit(ExitCode.Error);
      }

      if (isJsonMode()) {
        printJson(
          jsonSuccess({
            tool,
            files: result.count,
            directory: result.dir,
          }),
        );
      } else {
        success(
          `Installed ${result.count} files for ${result.description}`,
        );
        info(`  Location: ${result.dir}`);

        if (tool === "claude-code") {
          const reg = registerClaudeCodePlugin(result.dir);
          if (reg.ok) {
            success(`  ${reg.message}`);
            info("  Restart Claude Code to activate the plugin.");
          } else {
            warn(`  ${reg.message}`);
          }
        } else if (tool === "opencode") {
          warn("  Project-scoped — run from your project root.");
        }
      }
    });

  plugin
    .command("list")
    .description("List available tool integrations")
    .action(() => {
      if (isJsonMode()) {
        const tools = SUPPORTED_TOOLS.map((tool) => {
          const files = PLUGIN_FILES[tool];
          const target = getInstallTarget(tool);
          return {
            tool,
            files: files ? Object.keys(files).length : 0,
            directory: target.dir,
            installed: existsSync(target.dir),
          };
        });
        printJson(jsonSuccess(tools));
      } else {
        console.log("Available integrations:\n");
        for (const tool of SUPPORTED_TOOLS) {
          const files = PLUGIN_FILES[tool];
          const target = getInstallTarget(tool);
          const fileCount = files ? Object.keys(files).length : 0;
          const installed = existsSync(target.dir);
          const status = installed ? " (installed)" : "";
          console.log(
            `  ${tool.padEnd(14)} ${String(fileCount).padStart(2)} files  ${target.description}${status}`,
          );
        }
        console.log(
          `\nInstall: kolshek plugin install <tool>`,
        );
      }
    });
}
