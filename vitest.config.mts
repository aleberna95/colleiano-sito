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
    ],
  },
});
