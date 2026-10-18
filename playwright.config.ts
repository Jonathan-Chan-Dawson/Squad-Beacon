import { defineConfig } from "@playwright/test";
import path from "node:path";
const previewPort = process.env.PLAYWRIGHT_PORT ?? "4173";
export default defineConfig({
  testDir: "tests/browser",
  fullyParallel: false,
  use: {
    baseURL: `http://127.0.0.1:${previewPort}`,
    viewport: { width: 390, height: 844 },
    trace: "retain-on-failure",
    channel: process.platform === "win32" ? "chrome" : undefined,
  },
  webServer: {
    command: 'node "' + path.join(__dirname, "scripts/serve-preview.cjs") + '"',
    url: `http://127.0.0.1:${previewPort}`,
    env: { PORT: previewPort },
    reuseExistingServer: !process.env.CI,
  },
  reporter: "list",
});
