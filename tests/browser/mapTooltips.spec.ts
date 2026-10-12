import { expect, test } from "@playwright/test";

test("compass toolbar stays within phone bounds and map taps collapse it", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  const discoveryHint = page.getByRole("button", {
    name: "Got it",
    exact: true,
  });
  if (await discoveryHint.isVisible()) await discoveryHint.click();
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const compass = page.getByRole("button", {
      name: "Navigation",
      exact: true,
    });
    await expect(compass).toBeVisible();
    await expect(compass).toHaveAttribute("aria-expanded", "false");
    const compassBounds = await compass.boundingBox();
    expect(compassBounds!.x).toBeGreaterThanOrEqual(0);
    expect(compassBounds!.x + compassBounds!.width).toBeLessThanOrEqual(
      viewport.width,
    );
    expect(compassBounds!.y + compassBounds!.height).toBeLessThanOrEqual(
      viewport.height,
    );
    await page.screenshot({
      path: `test-results/map-compass-collapsed-${viewport.width}.png`,
    });
    await compass.click();
    const toolbar = page.getByTestId("map-navigation-popover");
    await expect(toolbar).toBeVisible();
    for (const action of [
      "Center on Me",
      "Return to Overview",
      "Explore Everywhere",
      "Pin a Location",
    ]) {
      const button = page.getByRole("button", { name: action, exact: true });
      await expect(button).toBeVisible();
      const buttonBounds = await button.boundingBox();
      expect(buttonBounds!.width).toBeGreaterThanOrEqual(44);
      expect(buttonBounds!.height).toBeGreaterThanOrEqual(44);
    }
    const bounds = await toolbar.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
    await page.screenshot({
      path: `test-results/map-compass-toolbar-${viewport.width}.png`,
    });
    await page
      .getByTestId("map-toolbar-dismiss-area")
      .click({ position: { x: 6, y: 180 } });
    await expect(toolbar).toHaveCount(0);
  }
});

test("side controls collapse, persist map type, and pin a real Beacon location", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  const compass = page.getByRole("button", { name: "Navigation", exact: true });
  await expect(compass).toHaveAttribute("aria-expanded", "false");
  await compass.click();
  const toolbar = page.getByTestId("map-navigation-popover");
  await expect(toolbar).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Map Display", exact: true }).click();
  const settings = page.getByTestId("map-map-display-popover");
  await expect(settings).toBeVisible();
  await settings
    .getByRole("button", { name: "Satellite map", exact: true })
    .click();
  await expect(
    settings.getByRole("button", { name: "Satellite map", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    settings.getByRole("button", { name: "More Map Settings", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/map-compass-settings-390.png" });
  await page
    .getByTestId("map-toolbar-dismiss-area")
    .click({ position: { x: 6, y: 180 } });
  await expect(toolbar).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("button", { name: "Map Display", exact: true }).click();
  await expect(
    page
      .getByTestId("map-map-display-popover")
      .getByRole("button", { name: "Satellite map", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Close map display" }).click();
  await expect(toolbar).toHaveCount(0);
  await compass.click();
  await page
    .getByRole("button", { name: "Pin a Location", exact: true })
    .click();
  await expect(
    page.getByText("Tap the map to drop a pin", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Beacon map", { exact: true })
    .click({ position: { x: 25, y: 390 } });
  await page
    .getByRole("button", { name: "Create Beacon here", exact: true })
    .click();
  await expect(page).toHaveURL(/\/create\?.*latitude=/);
  await page
    .getByLabel("Title / Activity", { exact: true })
    .fill("Pinned meetup");
  await expect(
    page.getByRole("button", { name: "Create Beacon", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Create Beacon", exact: true })
    .click();
  await expect(page).toHaveURL(/beacon=/);
  await page
    .getByTestId("map-tooltip-card")
    .getByRole("button", { name: "See overview", exact: true })
    .click();
  await expect(page.getByTestId("map-panel")).toContainText(
    "Pinned map location",
  );
});

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
]) {
  test(`friend tooltip stays compact at ${viewport.width}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/?person=map-friend-4");
    await page.getByRole("button", { name: /Explore the demo/ }).click();
    const card = page.getByTestId("map-person-preview");
    await expect(card).toBeVisible();
    await expect(card).toContainText("Leila Alvarez");
    await expect(card).toContainText("Free to hang");
    await expect(
      card.getByRole("button", { name: "Message Leila Alvarez", exact: true }),
    ).toBeVisible();
    await expect(
      card.getByRole("button", { name: "View profile", exact: true }),
    ).toBeVisible();
    await expect(card.getByText("Beacons", { exact: true })).toHaveCount(0);
    const box = await page.getByTestId("map-tooltip").boundingBox();
    expect(box!.width).toBeLessThanOrEqual(292);
    expect(box!.height).toBeLessThanOrEqual(336);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    await page.screenshot({
      path: `test-results/map-friend-tooltip-${viewport.width}.png`,
    });
    await card
      .getByRole("button", { name: "Close person preview", exact: true })
      .click();
    await expect(card).toHaveCount(0);
  });
}

test("Plan relationship closes the preview and preserves ordinary filters", async ({
  page,
}) => {
  await page.goto(
    "/?beacon=demo-routine%3Ademo-you%3Afriday%3Aplan%3Abeacon%3A2",
  );
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  const card = page.getByTestId("map-tooltip-card");
  await expect(card).toContainText("Bowling");
  await expect(card).toContainText("Stop 2 of 3");
  await card.getByRole("button", { name: "See overview", exact: true }).click();
  await expect(
    page
      .getByTestId("map-panel")
      .getByRole("button", { name: "View full Plan", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("map-panel")).toContainText("Next:");
  await page
    .getByTestId("map-panel")
    .getByRole("button", { name: /^Show Plan / })
    .click();
  await expect(card).toHaveCount(0);
  const context = page.getByRole("button", {
    name: /^Remove Plan: Friday Night Routine/,
  });
  await expect(context).toBeVisible();
  await page.getByTestId("map-filter-toggle").click();
  const filters = page.getByRole("dialog", { name: "Filters", exact: true });
  await filters.getByRole("button", { name: "Study", exact: true }).click();
  await filters.getByRole("button", { name: /^Show \d+ Beacons$/ }).click();
  await context.click();
  await expect(context).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Remove Study filter", exact: true }),
  ).toBeVisible();
});
