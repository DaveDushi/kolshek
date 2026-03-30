// kolshek page — manage custom dashboard pages.

import type { Command } from "commander";
import {
  listCustomPages,
  getCustomPage,
  createCustomPage,
  deleteCustomPage,
} from "../../db/repositories/custom-pages.js";
import { validatePage } from "../../core/page-schema.js";
import {
  info,
  success,
  printJson,
  isJsonMode,
  jsonSuccess,
  jsonError,
  createTable,
} from "../output.js";

export function registerPageCommand(program: Command): void {
  const page = program
    .command("page")
    .description("Manage custom dashboard pages");

  // page list
  page
    .command("list")
    .description("List all custom pages")
    .action(() => {
      const pages = listCustomPages();
      if (isJsonMode()) {
        printJson(jsonSuccess(pages));
        return;
      }
      if (pages.length === 0) {
        info("No custom pages. Use 'kolshek page create' to add one.");
        return;
      }
      const rows = pages.map((p) => [p.id, p.title, p.icon, p.description ?? ""]);
      const table = createTable(["ID", "Title", "Icon", "Description"], rows);
      console.log(table);
    });

  // page get <id>
  page
    .command("get <id>")
    .description("Export a custom page definition as JSON")
    .action((id: string) => {
      const p = getCustomPage(id);
      if (!p) {
        if (isJsonMode()) {
          printJson(jsonError("PAGE_NOT_FOUND", `Page "${id}" not found`));
        } else {
          console.error(`Page "${id}" not found.`);
        }
        process.exit(1);
      }
      if (isJsonMode()) {
        printJson(jsonSuccess(p));
      } else {
        console.log(JSON.stringify({
          id: p.id,
          title: p.title,
          icon: p.icon,
          description: p.description,
          layout: p.definition,
        }, null, 2));
      }
    });

  // page create --file <path>
  page
    .command("create")
    .description("Create a custom page from a JSON definition")
    .option("-f, --file <path>", "Path to JSON file (reads stdin if omitted)")
    .action(async (opts: { file?: string }) => {
      let jsonStr: string;

      if (opts.file) {
        const file = Bun.file(opts.file);
        if (!(await file.exists())) {
          if (isJsonMode()) {
            printJson(jsonError("FILE_NOT_FOUND", `File not found: ${opts.file}`));
          } else {
            console.error(`File not found: ${opts.file}`);
          }
          process.exit(1);
          return;
        }
        jsonStr = await file.text();
      } else {
        // Read from stdin
        const chunks: string[] = [];
        const reader = Bun.stdin.stream().getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(new TextDecoder().decode(value));
        }
        jsonStr = chunks.join("");
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        if (isJsonMode()) {
          printJson(jsonError("INVALID_JSON", "Could not parse JSON"));
        } else {
          console.error("Could not parse JSON input.");
        }
        process.exit(2);
        return;
      }

      const result = validatePage(parsed);
      if (!result.success) {
        if (isJsonMode()) {
          printJson(jsonError("VALIDATION_FAILED", result.error));
        } else {
          console.error(`Validation failed: ${result.error}`);
        }
        process.exit(2);
        return;
      }

      try {
        const created = createCustomPage({
          id: result.data.id,
          title: result.data.title,
          icon: result.data.icon,
          description: result.data.description,
          definition: result.data.layout as Record<string, unknown>,
        });
        if (isJsonMode()) {
          printJson(jsonSuccess(created));
        } else {
          success(`Created page "${created.title}" (${created.id})`);
          info(`View it at: http://localhost:3000/pages/${created.id}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("UNIQUE constraint")) {
          if (isJsonMode()) {
            printJson(jsonError("PAGE_EXISTS", "A page with this ID already exists"));
          } else {
            console.error("A page with this ID already exists.");
          }
          process.exit(1);
        } else {
          if (isJsonMode()) {
            printJson(jsonError("CREATE_FAILED", msg));
          } else {
            console.error(`Failed to create page: ${msg}`);
          }
          process.exit(1);
        }
      }
    });

  // page delete <id>
  page
    .command("delete <id>")
    .description("Delete a custom page")
    .action((id: string) => {
      const deleted = deleteCustomPage(id);
      if (!deleted) {
        if (isJsonMode()) {
          printJson(jsonError("PAGE_NOT_FOUND", `Page "${id}" not found`));
        } else {
          console.error(`Page "${id}" not found.`);
        }
        process.exit(1);
        return;
      }
      if (isJsonMode()) {
        printJson(jsonSuccess({ deleted: true, id }));
      } else {
        success(`Deleted page "${id}".`);
      }
    });
}
