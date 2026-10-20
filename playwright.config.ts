import { defineConfig, devices } from "@playwright/test";

// Gli emulatori li avvia `pnpm test:e2e` (firebase emulators:exec).
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
  },
  // Telefono da 375px (SPEC, definition of done)
  projects: [{ name: "mobile", use: { ...devices["iPhone 13"], browserName: "chromium", viewport: { width: 375, height: 740 } } }],
  // Build di produzione collegata agli emulatori: consuma meno memoria di `next dev`.
  webServer: {
    command: "pnpm exec next build && pnpm exec next start --port 3100",
    env: { NEXT_PUBLIC_USE_EMULATORS: "true" },
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
