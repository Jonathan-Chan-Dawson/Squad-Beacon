import { expect, test, type Page } from "@playwright/test";

async function demo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
}

test("quick map filters expand inline while map appearance stays separate", async ({
  page,
}) => {
  await demo(page);
  const context = page.getByTestId("map-area-context");
  await expect(context).toBeVisible();
  await page.screenshot({ path: "test-results/map-refined-390.png" });
  const before = await context.innerText();
  await page.getByRole("button", { name: /^Filters(?: \d+)?$/ }).click();
  const tray = page.getByTestId("map-filter-tray");
  await expect(tray).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const bounds = await tray.boundingBox();
  expect(bounds!.height).toBeLessThan(844 * 0.45);
  await tray.getByRole("button", { name: "Study", exact: true }).click();
  await expect(context).not.toHaveText(before);
  await tray.getByRole("button", { name: "More Filters", exact: true }).click();
  const advanced = page.getByRole("dialog");
  await expect(advanced).toHaveCount(1);
  await page.screenshot({ path: "test-results/map-advanced-filters-390.png" });
  await expect(
    advanced.getByRole("button", { name: /^Show \d+ Beacons$/i }),
  ).toBeInViewport();
  await expect(
    advanced.getByRole("button", { name: /^Zoom (in|out)$/i }),
  ).toHaveCount(0);
  await advanced
    .getByRole("button", { name: "Reset filters", exact: true })
    .click();
  await advanced.getByRole("button", { name: /^Show \d+ Beacons$/i }).click();
  await page.getByRole("button", { name: "Map options", exact: true }).click();
  const options = page.getByRole("dialog");
  await expect(
    options.getByRole("button", { name: "Fit visible results", exact: true }),
  ).toBeVisible();
  await expect(
    options.getByRole("button", { name: "Study", exact: true }),
  ).toHaveCount(0);
  await expect(
    options.getByRole("button", { name: /^Zoom (in|out)$/i }),
  ).toHaveCount(0);
  await options.getByRole("button", { name: "Done", exact: true }).click();
});

test("map header and consolidated sharing control fit a small screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (/Text strings must be rendered/.test(message.text()))
      errors.push(message.text());
  });
  await demo(page);
  await expect(page.getByTestId("map-exploration-header")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Compass", exact: true }),
  ).toBeInViewport();
  await expect(page.getByTestId("map-sharing-control")).toBeInViewport();
  await expect(
    page.getByRole("button", { name: "Manage location sharing", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Compass", exact: true }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Use my location", exact: true }),
  ).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: /Close/ }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/map-refined-320.png" });
  await page.getByRole("button", { name: /^Filters(?: \d+)?$/ }).click();
  await expect(page.getByTestId("map-filter-tray")).toHaveCSS("opacity", "1");
  await page.screenshot({ path: "test-results/map-filter-tray-320.png" });
  expect(errors).toEqual([]);
});

test("panning shows Search this area below the header without snapping back", async ({
  page,
}) => {
  await demo(page);
  await page
    .getByRole("textbox", {
      name: "Search Beacons, People, and places",
      exact: true,
    })
    .click();
  await page
    .getByRole("textbox", {
      name: "Search Beacons, People, and places",
      exact: true,
    })
    .fill("game room");
  await page
    .getByRole("button", { name: /^Explore The game room$/i })
    .first()
    .click();
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await page.mouse.move(210, 430);
  await page.mouse.wheel(0, 600);
  await page.mouse.move(210, 430);
  await page.mouse.down();
  await page.mouse.move(80, 510, { steps: 12 });
  await page.mouse.up();
  const searchArea = page.getByRole("button", {
    name: "Search this area",
    exact: true,
  });
  await expect(searchArea).toBeVisible();
  const header = await page.getByTestId("map-exploration-header").boundingBox();
  const button = await searchArea.boundingBox();
  expect(button!.y).toBeLessThan(844 * 0.4);
  expect(button!.y).toBeGreaterThan(header!.y);
  await searchArea.click();
  await expect(searchArea).toHaveCount(0);
  await expect(page.getByTestId("map-area-context")).toContainText(/area/i);
});
