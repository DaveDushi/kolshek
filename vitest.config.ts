import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "bun:sqlite": resolve(__dirname, "tests/fixtures/bun-sqlite-mock.ts"),
    },
  },
  plugins: [
    {
      name: "bun-compat",
      transform(code, id) {
        // Replace Bun-specific import.meta.dir with Node-compatible equivalent
        if (code.includes("import.meta.dir")) {
          return code.replace(
            /import\.meta\.dir/g,
            'new URL(".", import.meta.url).pathname.replace(/^\\/([A-Z]:)/, "$1")',
          );
        }
      },
    },
  ],
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/cli/index.ts"],
    },
  },
});
