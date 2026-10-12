import { expect, test } from "@playwright/test";

test("side menu stays within phone bounds and map taps dismiss it", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.getByRole("button", { name: "Compass", exact: true }).click();
    const menu = page.getByTestId("map-side-menu");
    await expect(menu).toBeVisible();
    const bounds = await menu.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
    await page.screenshot({
      path: `test-results/map-side-menu-${viewport.width}.png`,
    });
    await page
      .getByTestId("map-side-menu-dismiss-area")
      .click({ position: { x: 6, y: 180 } });
    await expect(menu).toHaveCount(0);
  }
});

test("side controls collapse, persist map type, and pin a real Beacon location", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  const pin = page.getByRole("button", {
    name: "Pin a location to create a Beacon",
    exact: true,
  });
  await expect(pin).toBeVisible();
  const box = await pin.boundingBox();
  expect(box!.x).toBeGreaterThan(300);
  expect(box!.y).toBeLessThan(300);
  expect(box!.width).toBeGreaterThanOrEqual(44);
  const compass = page.getByRole("button", { name: "Compass", exact: true });
  await expect(compass).toHaveAttribute("aria-expanded", "false");
  await compass.click();
  const menu = page.getByTestId("map-side-menu");
  await expect(menu).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await menu
    .getByRole("button", { name: "Satellite map", exact: true })
    .click();
  await expect(
    menu.getByRole("button", { name: "Satellite map", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.screenshot({ path: "test-results/map-side-menu-390.png" });
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await compass.click();
  await expect(
    menu.getByRole("button", { name: "Satellite map", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await compass.click();
  await expect(menu).toHaveCount(0);
  await pin.click();
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
