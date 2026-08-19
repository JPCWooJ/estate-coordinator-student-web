import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  retries: 0,
  reporter: "line",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  expect: { timeout: 20_000 },
  use: {
    baseURL: "http://127.0.0.1:3100",
    actionTimeout: 20_000,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "node tests/e2e/start-server.mjs",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      EC_SYNTHETIC_TEST_MODE: "true",
    },
  },
});
