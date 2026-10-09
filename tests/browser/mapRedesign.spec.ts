import { expect, test } from "@playwright/test";

async function enterDemo(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
}

test("web map follows light and dark appearance and keeps map attributions visible", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(() => {
    localStorage.setItem("beacon.appearance", "system");
  });
  await enterDemo(page);

  const lightTile = page.locator("img.leaflet-tile").first();
  await expect(lightTile).toBeAttached();
  await expect
    .poll(async () => lightTile.getAttribute("src"))
    .toContain("/light_all/");
  await expect(page.getByRole("link", { name: /OpenStreetMap/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "CARTO", exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/map-redesign-light-390.png" });

  await page.emulateMedia({ colorScheme: "dark" });
  await expect
    .poll(async () => page.locator("img.leaflet-tile").first().getAttribute("src"))
    .toContain("/dark_all/");
  await page.screenshot({ path: "test-results/map-redesign-dark-390.png" });
});

test("empty map search explains that no matching results exist", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enterDemo(page);

  const search = page.getByRole("textbox", {
    name: "Search Beacons, People, and places",
  });
  await search.fill("no-real-beacon-person-or-place-932841");
  const results = page.getByTestId("map-search-results");
  await expect(results).toBeVisible();
  await expect(
    results.getByText("No matching Beacons, people or places yet.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(results.getByRole("button", { name: /^Open .* Beacon$/ })).toHaveCount(0);
  await expect(
    results.getByRole("button", { name: "Choose a point on the map", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/map-redesign-search-empty-390.png" });
});
