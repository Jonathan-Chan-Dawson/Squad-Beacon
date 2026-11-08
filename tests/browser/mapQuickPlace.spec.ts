import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.routeWebSocket("**/hot", () => {});
  await page.routeWebSocket("**/message", () => {});
});

// Shared normal placement and hold journeys live in mapUnifiedPlace.spec.ts.
test("returning from the Map updates only the existing draft location, including Cancel", async ({
  page,
}) => {
  test.setTimeout(45000);
  await page.addInitScript(() =>
    localStorage.setItem(
      "beacon.map-device.v2",
      JSON.stringify({ hintsSeen: 3 }),
    ),
  );
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page
    .getByRole("button", { name: "+ Create Blank Beacon", exact: true })
    .click();
  const title = page.getByLabel("Activity title", { exact: true });
  await title.fill("Keep this draft intact");
  await page
    .getByRole("button", { name: "Choose location on Map", exact: true })
    .click();
  await page
    .locator(".leaflet-container")
    .last()
    .click({ position: { x: 190, y: 380 }, force: true });
  const tooltip = page.getByTestId("map-place-confirmation").last();
  await expect(
    tooltip.getByRole("button", { name: "Use This Location", exact: true }),
  ).toBeVisible();
  await expect(
    tooltip.getByRole("button", { name: "Create Beacon", exact: true }),
  ).toHaveCount(0);
  await tooltip
    .getByRole("button", { name: "Use This Location", exact: true })
    .click();
  await expect(title).toHaveValue("Keep this draft intact");
  await page
    .getByRole("button", { name: "Adjust on Map", exact: true })
    .click();
  await expect(tooltip).toBeVisible();
  const pin = page.getByTestId("map-temporary-pin").last();
  const oldPoint = await pin.getAttribute("data-latitude");
  await page
    .locator(".leaflet-container")
    .last()
    .click({ position: { x: 30, y: 540 }, force: true });
  await expect(pin).not.toHaveAttribute("data-latitude", oldPoint!);
  await tooltip
    .getByRole("button", { name: "Cancel location placement", exact: true })
    .click();
  await expect(title).toHaveValue("Keep this draft intact");
  await page
    .getByRole("button", { name: "Adjust on Map", exact: true })
    .click();
  await expect(pin).toHaveAttribute("data-latitude", oldPoint!);
  await tooltip
    .getByRole("button", { name: "Search for a location", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Search location", exact: true })
    .fill("Chicago");
  await page
    .getByRole("button", { name: "Search worldwide places", exact: true })
    .click();
  await page
    .getByRole("button", { name: /^Explore Chicago$/ })
    .first()
    .click();
  await expect(tooltip).toContainText("Chicago");
  await tooltip
    .getByRole("button", { name: "Use This Location", exact: true })
    .click();
  await expect(title).toHaveValue("Keep this draft intact");
});
