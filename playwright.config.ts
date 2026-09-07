import { defineConfig } from "@playwright/test";
import path from "node:path";
export default defineConfig({
  testDir: "tests/browser",
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 390, height: 844 },
    trace: "retain-on-failure",
    channel: process.platform === "win32" ? "chrome" : undefined,
  },
  webServer: {
    command: 'node "' + path.join(__dirname, "scripts/serve-preview.cjs") + '"',
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
  reporter: "list",
});
