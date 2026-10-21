import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    projects: [
      {
        extends: true,
        test: { name: "unit", include: ["tests/unit/**/*.test.ts"] },
      },
      {
        // Richiedono l'emulatore: si lanciano con `pnpm test:rules`
        extends: true,
        test: {
          name: "rules",
          include: ["tests/rules/**/*.test.ts"],
          fileParallelism: false,
          testTimeout: 20000,
        },
      },
      {
        // Richiedono gli emulatori con le Functions: `pnpm test:functions`
        extends: true,
        test: {
          name: "functions",
          include: ["tests/functions/**/*.test.ts"],
          fileParallelism: false,
          testTimeout: 30000,
          hookTimeout: 30000,
        },
      },
    ],
  },
});
