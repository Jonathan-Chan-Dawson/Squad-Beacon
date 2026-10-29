import { defineConfig } from "@playwright/test";

// Isolated HTTP contract fixture, deliberately independent of Phase 4's preview
// server. This suite does not establish hosted Auth or database acceptance.
export default defineConfig({
  testDir: "tests/browser",
  testMatch: ["guestInvitations.spec.ts", "guestCanonical.spec.ts", "guestPlanning.spec.ts"],
  fullyParallel: false,
  workers: 1,
  use: { viewport: { width: 390, height: 844 }, channel: process.platform === "win32" ? "chrome" : undefined, trace: "retain-on-failure" },
  reporter: "list",
});
