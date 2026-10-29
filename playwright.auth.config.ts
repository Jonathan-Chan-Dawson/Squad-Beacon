import { defineConfig } from "@playwright/test";
import onboarding from "./playwright.onboarding.config";

export default defineConfig({
  ...onboarding,
  testMatch: [
    "authEmailLinks.spec.ts",
    "authConfirmationLayout.spec.ts",
    "accountEntry.spec.ts",
    "onboarding.spec.ts",
  ],
  outputDir: "test-results/auth-email",
  use: { ...onboarding.use, baseURL: "http://127.0.0.1:4189" },
  webServer: {
    command: "node scripts/serve-preview.cjs",
    url: "http://127.0.0.1:4189",
    env: { PORT: "4189", PREVIEW_DIR: "../.expo/auth-email-dev" },
    reuseExistingServer: false,
  },
});
