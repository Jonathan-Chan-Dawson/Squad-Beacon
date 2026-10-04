import { expect, test, type Page } from "@playwright/test";

async function startDemo(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
}

test("map clusters drill into Beacons and People, focus a Beacon, and dismiss on map tap", async ({
  page,
}) => {
  await startDemo(page);
  await expect(
    page.getByRole("button", { name: "Fit all beacons", exact: true }),
  ).toBeVisible();
  const zoomOut = page.getByRole("button", { name: "Zoom out", exact: true });
  await zoomOut.click();
  await zoomOut.click();

  const cluster = page
    .getByRole("button", {
      name: /^Map cluster: [1-9]\d* beacons, [1-9]\d* people$/,
    })
    .first();
  await expect(cluster).toBeVisible();
  await cluster.click();
  const panel = page.getByTestId("map-cluster-panel");
  await expect(panel).toBeVisible();
  await expect(panel.getByText("BEACONS", { exact: true })).toBeVisible();
  await expect(panel.getByText(/\d+ Beacons · [1-9]\d* People/)).toBeVisible();

  const beacon = panel
    .getByRole("button", { name: /^Expand .* in map cluster/ })
    .first();
  await beacon.click();
  await expect(
    panel.getByRole("button", { name: "Open Beacon", exact: true }),
  ).toBeVisible();
  await panel.getByRole("button", { name: "Open Beacon", exact: true }).click();
  await expect(panel).toHaveCount(0);
  await expect(page.getByTestId("map-tooltip")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Beacon details" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);

  const map = page.locator('[aria-label="Beacon map"]');
  const bounds = await map.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.click(bounds!.x + 8, bounds!.y + bounds!.height * 0.65);
  await expect(page.getByTestId("map-tooltip")).toHaveCount(0);
  await expect(page.getByTestId("map-cluster-panel")).toHaveCount(0);
  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
  await page.getByRole("tab", { name: "Map", exact: true }).click();
  await expect(page.getByTestId("map-tooltip")).toHaveCount(0);
  await expect(page.getByTestId("map-cluster-panel")).toHaveCount(0);
});

test("Draw-created Beacon links back to its decision", async ({ page }) => {
  await startDemo(page);
  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
  await page.getByRole("button", { name: "Upcoming", exact: true }).click();
  await page
    .getByRole("button", { name: "View A surprise crew meetup details" })
    .click();

  await expect(page.getByTestId("map-tooltip")).toBeVisible();
  await expect(page.getByText("Chosen by Draw", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Beacon details" }).click();
  await expect(
    page.getByRole("button", { name: "View Draw decision", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "View Draw decision", exact: true })
    .click();

  await expect(page).toHaveURL(/\/council\/demo-draw-result$/);
  await expect(page.getByText(/Crew.?s surprise meetup/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open beacon", exact: true }),
  ).toBeVisible();
});
