import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

/**
 * E2E config for the web SPA. Builds the app and serves the static output
 * with `vite preview`, then runs the smoke specs in test/*.e2e.spec.ts.
 */
export default defineConfig({
  testDir: "test",
  testMatch: /.*\.e2e\.spec\.ts/,
  timeout: 30_000,
  fullyParallel: true,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npx vite build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
