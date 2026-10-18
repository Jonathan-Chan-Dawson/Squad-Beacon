import { test, expect } from "@playwright/test";

async function home(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
}
for (const width of [320, 390, 430]) {
  test(`collection and composer remain usable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await home(page);
    await page
      .getByRole("button", { name: /Add a status note|Edit your status note/ })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("radio", { name: "Available", exact: true }),
    ).toBeVisible();
    await dialog.screenshot({
      path: `test-results/status-composer-initial-${width}.png`,
    });
    await dialog
      .getByLabel("Activity Note", { exact: true })
      .fill("A quiet coffee and a good book");
    await dialog.getByRole("radio", { name: "Busy", exact: true }).click();
    await dialog.getByRole("button", { name: "1 Hour", exact: true }).click();
    await expect(
      dialog.getByRole("radio", { name: "Busy", exact: true }),
    ).toBeChecked();
    await dialog.screenshot({
      path: `test-results/status-composer-${width}.png`,
    });
    await dialog
      .getByRole("button", { name: "Save Status", exact: true })
      .click();
    await expect(page.getByTestId("compact-own-status")).toContainText(
      "A quiet coffee and a good book",
    );
    await page
      .getByRole("button", { name: "My Collection", exact: true })
      .click();
    await expect(page).toHaveURL(/my-collection/);
    await expect(
      page.getByRole("button", { name: "Saved Beacons", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/my-collection-${width}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("button", { name: "Favorite Friends", exact: true })
      .click();
    await expect(page).toHaveURL(/section=friends/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
}

test("Map overview opens directly and restores the selection on return", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  const search = page.getByRole("textbox", {
    name: "Search places, Beacons, people and communities",
    exact: true,
  });
  await search.fill("origami");
  await page
    .getByRole("button", {
      name: "Open Morning origami swap Beacon",
      exact: true,
    })
    .click();
  const preview = page.getByTestId("map-tooltip-card");
  await expect(preview).toContainText("Morning origami swap");
  const camera = await page.locator(".leaflet-map-pane").getAttribute("style");
  await preview
    .getByRole("button", { name: "See overview", exact: true })
    .click();
  await expect(page).toHaveURL(/activity\/.+from=map/);
  await expect(page.getByTestId("activity-detail-hero")).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(preview).toContainText("Morning origami swap");
  await expect(page.locator(".leaflet-map-pane")).toHaveAttribute(
    "style",
    camera!,
  );
});

test("light theme and reduced motion retain the composer and collection controls", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("beacon.appearance", "light"),
  );
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  await home(page);
  await page
    .getByRole("button", { name: /Add a status note|Edit your status note/ })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Hide Activity Note", exact: true })
    .click();
  await expect(dialog.getByLabel("Activity Note", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    dialog.getByRole("button", { name: "Friends", exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: /Edit Activity Note|Add Activity Note/ })
    .click();
  await dialog
    .getByRole("button", { name: "More Details & Settings", exact: true })
    .click();
  await expect(dialog.getByLabel("Description", { exact: true })).toBeVisible();
  await dialog.screenshot({ path: "test-results/status-composer-light.png" });
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("button", { name: "My Collection", exact: true })
    .click();
  await page.screenshot({
    path: "test-results/my-collection-light.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "My Templates", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "New Template", exact: true }),
  ).toBeVisible();
});

test("saved Beacons browse and unsave from full collection pages", async ({
  page,
}) => {
  await home(page);
  const card = page
    .getByTestId("home-explore-beacons")
    .getByTestId(/^beacon-feed-card-/)
    .first();
  const title = await card.getByRole("heading").textContent();
  await card
    .getByRole("button", { name: "More Beacon actions", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save Beacon", exact: true })
    .click();
  await page
    .getByRole("button", { name: "My Collection", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: `Open ${title}`, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Saved Beacons", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: `Unsave ${title}`, exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: `Open ${title}`, exact: true }),
  ).toHaveCount(0);
});
