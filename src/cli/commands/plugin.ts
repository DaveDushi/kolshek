/**
 * kolshek plugin — Install AI agent integrations for various tools.
 */

import type { Command } from "commander";
import { existsSync, mkdirSync, writeFileSync } from "fs";
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
  "openclaw",
  "cursor",
  "gemini-cli",
  "antigravity",
  "opencode",
  "aider",
  "windsurf",
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
    case "openclaw":
      return {
        dir: join(home, ".openclaw", "skills"),
        description: "OpenClaw skills",
      };
    case "cursor":
      return {
        dir: join(process.cwd(), ".cursor", "rules"),
        description: "Cursor rules (project-scoped)",
      };
    case "gemini-cli":
      return {
        dir: join(home, ".gemini", "extensions", "kolshek"),
        description: "Gemini CLI extension",
      };
    case "antigravity":
      return {
        dir: join(home, ".gemini", "antigravity", "skills"),
        description: "Antigravity skills",
      };
    case "opencode":
      return {
        dir: join(process.cwd(), ".opencode", "agent"),
        description: "OpenCode agents (project-scoped)",
      };
    case "aider":
      return {
        dir: process.cwd(),
        description: "Aider conventions (project-scoped)",
      };
    case "windsurf":
      return {
        dir: process.cwd(),
        description: "Windsurf rules (project-scoped)",
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
  writeFiles(files, target.dir);

  const count = Object.keys(files).length;
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

        // Tool-specific post-install hints
        if (tool === "claude-code") {
          info(
            `  Add to settings: "pluginDirs": ["${result.dir}"]`,
          );
        } else if (tool === "openclaw") {
          info(
            "  Skills are ready. Restart OpenClaw or ask it to refresh skills.",
          );
        } else if (
          tool === "cursor" ||
          tool === "opencode" ||
          tool === "aider" ||
          tool === "windsurf"
        ) {
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
