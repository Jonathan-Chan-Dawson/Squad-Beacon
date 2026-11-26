import { expect, test, type Page } from "@playwright/test";
import { mockOnboardingAccount } from "./onboardingAccount";
import { startDemoFromEntry } from "./demoEntry";

async function enterDemo(page: Page) {
  await mockOnboardingAccount(page, { signedOut: true });
  await page.route(/.*(?:cartocdn\.com|basemaps\.carto\.com).*/, route => route.abort());
  await page.goto("/auth/sign-in");
  const demo = page.getByRole("button", { name: /Explore the demo/ });
  await expect.poll(() => demo.evaluate(node => Object.keys(node).some(key => key.startsWith("__reactProps$")))).toBe(true);
  await demo.click();
  await expect(page.getByTestId("full-map-screen")).toBeVisible();
}

for (const appearance of ["light", "dark"] as const) {
  test(`selected Beacon separates identity, hosting, attendance and actions in ${appearance}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: appearance === "dark" ? 320 : 390, height: 844 });
    await page.addInitScript(
      (value) => localStorage.setItem("beacon.appearance", value),
      appearance,
    );
    await enterDemo(page);
    const search = page.getByRole("textbox", {
      name: "Search places, Beacons, people and communities",
    });
    await search.fill("Plan stop 1: Coffee together");
    await page
      .getByTestId("map-search-results")
      .getByRole("button", { name: "Open Plan stop 1: Coffee together Beacon" })
      .click();

    const card = page.getByTestId("map-tooltip-card");
    const map = page.getByLabel("Beacon map", { exact: true });
    const selectedPin = map.locator('button[aria-label^="Map: Plan stop 1: Coffee together"]');
    await expect(selectedPin).toHaveAttribute("aria-current", "true");
    const identity = card.getByTestId("map-beacon-identity");
    const attendance = card.getByTestId("discovery-going-count");
    const actions = card.getByTestId("discovery-card-actions");
    const planStop = identity.getByRole("button", { name: "Zoom to Fit", exact: true });
    await expect(
      identity.getByRole("heading", { name: "Coffee together" }),
    ).toBeVisible();
    const pattern = card.locator('[aria-hidden="true"]').filter({ has: page.locator("svg defs") }).first();
    await expect(pattern.locator("svg circle").first()).toBeVisible();
    await expect(pattern).toHaveCSS("pointer-events", "none");
    await expect(planStop).toBeInViewport();
    await expect(identity.getByTestId("beacon-plan-position")).toHaveText("1/3");
    expect((await card.boundingBox())!.height).toBeLessThan(360);
    await expect(attendance).toBeVisible();
    await expect(actions).toBeInViewport({ ratio: 0.9 });
    const hosting = card.getByTestId("map-hosting-status");
    await expect(hosting).toBeVisible();
    const tools = actions.getByRole("button", { name: /^Beacon tools/ });
    await expect(tools).toBeInViewport({ ratio: 0.9 });
    await tools.click({ trial: true });
    const close = identity.getByRole("button", { name: "Close map preview" });
    const bookmark = identity.getByRole("button", { name: "Save Beacon", exact: true });
    await expect(close).toBeInViewport({ ratio: 0.9 });
    await expect(bookmark).toBeInViewport({ ratio: 0.9 });
    const timing = (await card.getByTestId("discovery-timing").boundingBox())!;
    const hostControls = (await hosting.boundingBox())!;
    expect(timing.x + timing.width).toBeLessThanOrEqual(hostControls.x);
    expect(Math.abs(timing.y + timing.height / 2 - hostControls.y - hostControls.height / 2)).toBeLessThan(2);
    expect((await hosting.boundingBox())!.y).toBeLessThan(
      (await attendance.boundingBox())!.y,
    );
    expect((await attendance.boundingBox())!.y).toBeLessThan(
      (await actions.boundingBox())!.y,
    );
    const screenshot = testInfo.outputPath(`beacon-map-${appearance}.png`);
    await page.screenshot({ path: screenshot, animations: "disabled" });
    await testInfo.attach("Selected Beacon", {
      path: screenshot,
      contentType: "image/png",
    });
    await bookmark.click();
    const unsave = identity.getByRole("button", { name: "Unsave Beacon", exact: true });
    await expect(unsave).toBeVisible();
    await unsave.click();
    await expect(bookmark).toBeVisible();
    await planStop.click();
    const planFocus = page.getByTestId("map-plan-focus");
    await expect(planFocus).toContainText("3 stops");
    await expect(planFocus.getByTestId("map-plan-filter-name")).toHaveCSS("text-overflow", "ellipsis");
    await expect(planFocus.getByRole("button", { name: "Fit Plan", exact: true })).toBeInViewport();
    for (const stop of [1, 2, 3]) {
      const pin = map.getByRole("button", { name: new RegExp(`^Plan stop ${stop}:`, "i") });
      await expect(pin).toBeInViewport();
    }
    await page.screenshot({ path: testInfo.outputPath(`beacon-plan-focus-${appearance}.png`), animations: "disabled" });
    const artStop = map.getByRole("button", { name: /^Plan stop 2:/i });
    await artStop.click();
    await expect(card.getByRole("heading", { name: "Art museum visit" })).toBeVisible();
    await expect(card.getByTestId("beacon-plan-position")).toHaveText("2/3");
    await close.click();
    await expect(card).toHaveCount(0);
    await planFocus.getByRole("button", { name: "Exit Plan Focus" }).click();
    await expect(planFocus).toHaveCount(0);
  });
}

test("Free hosts can choose and reset a built-in Map icon in Create", async ({
  page,
}) => {
  await enterDemo(page);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByRole("button", { name: "+ Create Blank Beacon", exact: true }).click();
  await page.getByRole("button", { name: "Customize appearance", exact: true }).click();
  const appearance = page.getByRole("dialog", {
    name: "Appearance",
    exact: true,
  });
  await expect(
    appearance.getByRole("button", { name: "Upload an image", exact: true }),
  ).toBeVisible();
  const chooser = page.waitForEvent("filechooser");
  await appearance.getByRole("button", { name: "Upload an image", exact: true }).click();
  await (await chooser).setFiles("assets/images/favicon.png");
  await expect(appearance.getByLabel("Map pin preview").locator("img")).toHaveCount(1);
  await appearance
    .getByRole("button", { name: "Choose an icon", exact: true })
    .click();
  await appearance.getByRole("button", { name: "Trophy", exact: true }).click();
  await expect(
    appearance.getByRole("button", {
      name: "Show custom icon in public discovery",
    }),
  ).toBeVisible();
  await appearance
    .getByRole("button", { name: "Category default", exact: true })
    .click();
  await expect(
    appearance.getByRole("button", {
      name: "Show custom icon in public discovery",
    }),
  ).toHaveCount(0);
});

test("a Squad can add an optional topic and members can follow or unfollow it", async ({ page }) => {
  await mockOnboardingAccount(page, { signedOut: true });
  await page.goto("/squad/auburn-hoops");
  await startDemoFromEntry(page);
  const settings = page.getByRole("button", { name: "Squad settings", exact: true });
  await expect(page.getByText("Beacon Topics", { exact: true })).toHaveCount(0);
  await settings.click();
  await page.getByRole("button", { name: "Manage Topics", exact: true }).click();
  const topics = page.getByRole("dialog", { name: "Manage Topics", exact: true });
  await topics.getByRole("button", { name: "Add Topic", exact: true }).click();
  await topics.getByLabel("Topic name", { exact: true }).fill("Tournaments");
  await topics.getByRole("button", { name: "Save topic", exact: true }).click();
  await expect(topics.getByRole("button", { name: "Save topic", exact: true })).toHaveCount(0);
  if (await topics.isVisible()) await page.keyboard.press("Escape");
  await expect(topics).toHaveCount(0);
  await settings.click();
  await page.getByRole("button", { name: "Tournaments", exact: true }).click();
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  const unfollow = page.getByRole("button", { name: "Unfollow", exact: true });
  await expect(unfollow).toBeVisible();
  await unfollow.click();
  await expect(page.getByRole("button", { name: "Follow", exact: true })).toBeVisible();
});
