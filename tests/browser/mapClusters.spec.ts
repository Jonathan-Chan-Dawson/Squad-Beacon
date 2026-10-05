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
  await page.getByRole("button", { name: "Map options", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Fit visible results", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Fit visible results", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // Web wheel zoom exercises the map gesture instead of removed mobile +/- UI.
  await page.mouse.move(195, 390);
  await page.mouse.wheel(0, 1200);

  const cluster = page
    .getByRole("button", {
      name: /^Map cluster: [1-9]\d* beacons, [1-9]\d* people\. Preview:/,
    })
    .first();
  await expect(cluster).toBeVisible();
  await expect(cluster).toHaveAccessibleName(/Preview:/);
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
    page.getByRole("button", { name: /^(Open|Manage) .* Beacon$/ }),
  ).toBeVisible();
  await expect(page.getByTestId("map-tooltip-card")).toContainText("going");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);

  await page
    .getByRole("button", { name: "Close map preview", exact: true })
    .click();
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
    .getByRole("button", {
      name: "View A surprise crew meetup details",
      exact: true,
    })
    .click();

  await expect(page.getByTestId("map-tooltip")).toBeVisible();
  await expect(page.getByText("Chosen by Draw", { exact: true })).toBeVisible();
  await page
    .getByRole("button", {
      name: "Open A surprise crew meetup Beacon details",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/\/activity\/demo-draw-beacon$/);
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
