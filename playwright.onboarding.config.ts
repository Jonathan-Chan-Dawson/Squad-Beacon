import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  testMatch: "onboarding.spec.ts",
  outputDir: "test-results/onboarding",
  fullyParallel: false,
  workers: 1,
  timeout: 120000,
  use: {
    baseURL: "http://127.0.0.1:4186",
    viewport: { width: 390, height: 844 },
    channel: process.platform === "win32" ? "chrome" : undefined,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/serve-preview.cjs",
    url: "http://127.0.0.1:4186",
    env: { PORT: "4186", PREVIEW_DIR: "../.expo/onboarding-dev" },
    reuseExistingServer: !process.env.CI,
  },
  reporter: "list",
});
