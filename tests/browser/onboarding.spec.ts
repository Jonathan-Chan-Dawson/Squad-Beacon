import { test, expect, type Page } from "@playwright/test";
import {
  scenarios,
  type DemoScenario,
} from "../../src/features/onboarding/scenarios";
import { mockOnboardingAccount } from "./onboardingAccount";

// Exported development bundles keep Expo's hot-reload client. Keep its sockets
// connected without updates; this preview intentionally has no Metro server.
test.beforeEach(async ({ page }) => {
  await page.routeWebSocket("**/hot", () => {});
  await page.routeWebSocket("**/message", () => {});
});

async function enter(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
}
function visibleId(page: Page, id: string) {
  return page.locator(`[data-testid="${id}"]:visible`);
}
async function scenario(page: Page, name: DemoScenario, screen = "Home") {
  await page.getByRole("button", { name: /Developer lab:/ }).click();
  await page
    .getByRole("button", { name: `Scenario: ${scenarios[name]}`, exact: true })
    .click();
  await expect(
    page.getByText("Onboarding developer lab", { exact: true }),
  ).toBeHidden();
  if (screen === "Home") return;
  await page.getByRole("button", { name: /Developer lab:/ }).click();
  await page
    .getByRole("button", { name: `Open ${screen}`, exact: true })
    .click();
  await expect(
    page.getByText("Onboarding developer lab", { exact: true }),
  ).toBeHidden();
}
test("fresh home has one useful introduction; dismissal and account context remain isolated", async ({
  page,
}) => {
  await enter(page);
  await scenario(page, "fresh");
  await expect(
    visibleId(page, "onboarding-welcome").getByText(
      "Your next story starts here.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(visibleId(page, "home-personal-timeline")).toHaveCount(0);
  await expect(visibleId(page, "home-friends-section")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Dismiss welcome", exact: true })
    .click();
  await expect(visibleId(page, "onboarding-returning")).toBeVisible();
  await page
    .getByRole("button", { name: "Explore Beacons", exact: true })
    .click();
  await expect(visibleId(page, "browse-beacons-empty")).toBeVisible();
  await page.goBack();
  await expect(visibleId(page, "onboarding-welcome")).toHaveCount(0);
  await scenario(page, "friends");
  await expect(visibleId(page, "home-friends-section")).toBeVisible();
  await expect(visibleId(page, "onboarding-welcome")).toHaveCount(0);
  await page.getByRole("button", { name: /Developer lab:/ }).click();
  await page.getByRole("button", { name: "Open Friends", exact: true }).click();
  await page.getByPlaceholder("Search people and groups").fill("zz-no-person");
  await scenario(page, "fresh");
  await expect(visibleId(page, "onboarding-welcome")).toBeVisible();
  await page.getByRole("button", { name: /Developer lab:/ }).click();
  await page.getByRole("button", { name: "Open Friends", exact: true }).click();
  await expect(page.getByPlaceholder("Search people and groups")).toHaveValue(
    "",
  );
});
test("real discovery and response components handle all ten scenarios", async ({
  page,
}) => {
  await enter(page);
  for (const name of Object.keys(scenarios) as DemoScenario[]) {
    await scenario(page, name);
    await expect(
      page.getByRole("button", { name: `Developer lab: ${scenarios[name]}` }),
    ).toBeVisible();
    if (name === "offline") {
      await expect(
        page.getByText(
          "Simulated connection error. Reconnect to load Beacons.",
          { exact: true },
        ),
      ).toBeVisible();
      await expect(visibleId(page, "onboarding-welcome")).toHaveCount(0);
      await page
        .getByRole("button", { name: "Try again", exact: true })
        .click();
      await expect(
        page.getByRole("button", {
          name: /Developer lab: No friends or Squads/,
        }),
      ).toBeVisible();
    }
    if (name === "invitation" || name === "responses")
      await expect(
        page.getByRole("button", { name: "View invitations & responses" }),
      ).toBeVisible();
  }
  await scenario(page, "discovery", "Browse");
  await expect(
    page.getByText("A walk and a good coffee", { exact: true }).first(),
  ).toBeVisible();
  await scenario(page, "filtered", "Browse");
  const filtered = page.locator('[data-testid="browse-beacons-empty"]:visible');
  await expect(
    filtered.getByText("No matches with these filters."),
  ).toBeVisible();
  await filtered
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(visibleId(page, "browse-beacons-empty")).toHaveCount(0);
});
test("tips dismiss, remain dismissed on revisit and reset only in the demo lab", async ({
  page,
}) => {
  await enter(page);
  await scenario(page, "fresh", "Plans");
  await expect(
    page.getByText("Link multiple Beacons into one outing.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Dismiss plan tip" }).click();
  await page.goBack();
  await page.getByRole("button", { name: /Developer lab:/ }).click();
  await page.getByRole("button", { name: "Open Plans", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Dismiss plan tip" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /Developer lab:/ }).click();
  await page.getByRole("button", { name: "Reset contextual tips" }).click();
  await page.getByRole("button", { name: "Open Plans", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Dismiss plan tip" }),
  ).toBeVisible();
});

test("first published Beacon celebrates only after confirmation and does not replay on revisit", async ({
  page,
}) => {
  await enter(page);
  await scenario(page, "fresh", "Create");
  await page
    .getByRole("button", { name: "+ Create Blank Beacon", exact: true })
    .click();
  await page
    .getByLabel("Activity title", { exact: true })
    .fill("Our first outing");
  await expect(visibleId(page, "first-success")).toHaveCount(0);
  await page.getByRole("radio", { name: "Online", exact: true }).click();
  await page
    .getByLabel("HTTPS meeting link", { exact: true })
    .fill("https://example.com/meet");
  await page
    .getByRole("button", { name: "Create Beacon", exact: true })
    .click();
  // Creation now has an explicit, optional post-publication choice. Dismiss it
  // before interacting with the Phase 4A receipt beneath the modal.
  await page
    .getByRole("dialog")
    .filter({
      has: page.getByRole("heading", {
        name: "Created successfully",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Not Now", exact: true })
    .click();
  await expect(visibleId(page, "first-success")).toBeVisible();
  await expect(
    page.getByText("Your first Beacon is ready.", { exact: true }),
  ).toBeVisible();
  await page
    .getByTestId("first-success")
    .getByRole("button", { name: "Got it", exact: true })
    .click();
  await page.getByRole("button", { name: /Developer lab:/ }).click();
  await page.getByRole("button", { name: "Open Home", exact: true }).click();
  await expect(visibleId(page, "first-success")).toHaveCount(0);
  await expect(visibleId(page, "home-personal-timeline")).toBeVisible();
});
test("phone compositions, themes and restrained personality", async ({
  page,
}) => {
  await enter(page);
  for (const appearance of ["light", "dark"] as const) {
    await page.getByRole("button", { name: /Developer lab:/ }).click();
    await page
      .getByRole("button", { name: `Preview ${appearance}`, exact: true })
      .click();
    await page.getByRole("button", { name: "Open Home", exact: true }).click();
    await expect(
      page.getByText("Onboarding developer lab", { exact: true }),
    ).toBeHidden();
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await scenario(page, "fresh");
      await expect(visibleId(page, "onboarding-welcome")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Explore Beacons", exact: true }),
      ).toBeInViewport();
      await page.screenshot({
        path: `test-results/onboarding-welcome-${appearance}-${width}.png`,
        fullPage: true,
      });
      await scenario(page, "disconnected");
      await page.screenshot({
        path: `test-results/onboarding-returning-${appearance}-${width}.png`,
        fullPage: true,
      });
    }
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await scenario(page, "fresh");
  await page.addStyleTag({
    content:
      '[data-testid="onboarding-welcome"] div[dir="auto"] { font-size: 24px !important; line-height: 1.4 !important; }',
  });
  await page.screenshot({
    path: "test-results/onboarding-large-text-reduced-motion.png",
    fullPage: true,
  });
  await page
    .getByText("Your next story starts here.", { exact: true })
    .evaluate((node) => {
      node.textContent =
        "Your next unforgettable shared adventure begins with a little possibility right here.";
    });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/onboarding-long-copy.png",
    fullPage: true,
  });
  await scenario(page, "disconnected", "Browse");
  await page.screenshot({
    path: "test-results/onboarding-discovery-empty.png",
    fullPage: true,
  });
  await scenario(page, "offline", "Browse");
  await page.screenshot({
    path: "test-results/onboarding-discovery-error.png",
    fullPage: true,
  });
});

test("account progress loads before introduction, persists across reload and does not identify unknown accounts as new", async ({
  page,
  browser,
}) => {
  const account = await mockOnboardingAccount(page, { delayRead: 800 });
  await page.goto("/activities");
  await expect(visibleId(page, "onboarding-welcome")).toBeVisible();
  await expect.poll(() => account.keys.has("welcome.seen.v1")).toBe(true);
  await page
    .getByRole("button", { name: "Dismiss welcome", exact: true })
    .click();
  await expect.poll(() => account.keys.has("welcome.dismissed.v1")).toBe(true);
  await page.reload();
  await expect(visibleId(page, "onboarding-returning")).toBeVisible();
  await expect(visibleId(page, "onboarding-welcome")).toHaveCount(0);
  const context = await browser.newContext();
  const reinstalled = await context.newPage();
  await reinstalled.routeWebSocket("**/hot", () => {});
  await reinstalled.routeWebSocket("**/message", () => {});
  await mockOnboardingAccount(reinstalled, { progress: account.keys });
  await reinstalled.goto("/activities");
  await expect(reinstalled.getByTestId("onboarding-returning")).toBeVisible();
  await expect(reinstalled.getByTestId("onboarding-welcome")).toHaveCount(0);
  const another = await context.newPage();
  await another.routeWebSocket("**/hot", () => {});
  await another.routeWebSocket("**/message", () => {});
  await mockOnboardingAccount(another, {
    viewer: "92222222-2222-4222-8222-222222222222",
    eligible: false,
  });
  await another.goto("/activities");
  await expect(another.getByTestId("onboarding-returning")).toBeVisible();
  await expect(another.getByTestId("onboarding-welcome")).toHaveCount(0);
  await expect(
    another.getByRole("button", { name: /Developer lab:/ }),
  ).toHaveCount(0);
  await context.close();
});

test("a failed progress write preserves the visit and retries only progress", async ({
  page,
}) => {
  const account = await mockOnboardingAccount(page, { failSave: true });
  await page.goto("/activities");
  await expect(visibleId(page, "onboarding-returning")).toBeVisible();
  await expect(visibleId(page, "onboarding-welcome")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Retry saving tips", exact: true })
    .click();
  await expect(visibleId(page, "onboarding-welcome")).toBeVisible();
  await page
    .getByRole("button", { name: "Dismiss welcome", exact: true })
    .click();
  await expect.poll(() => account.keys.has("welcome.seen.v1")).toBe(true);
  await page.reload();
  await expect(visibleId(page, "onboarding-welcome")).toHaveCount(0);
  await expect(visibleId(page, "onboarding-returning")).toBeVisible();
});
