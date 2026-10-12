import { expect, test } from "@playwright/test";

test("crowded demo Map discovers recent history and distinct public events", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  const search = page.getByRole("textbox", {
    name: "Search places, Beacons, people and communities",
    exact: true,
  });
  await search.fill("origami");
  const results = page.getByTestId("map-search-results");
  await results
    .getByRole("button", {
      name: "Open Morning origami swap Beacon",
      exact: true,
    })
    .click();
  await expect(page.getByTestId("map-tooltip-card")).toContainText(
    "Ended 2h ago",
  );
  const card = page.getByTestId("map-tooltip-card");
  expect((await card.boundingBox())!.width).toBeLessThanOrEqual(320);
  const overview = await card
    .getByRole("button", { name: "See overview", exact: true })
    .boundingBox();
  expect(overview!.width).toBeGreaterThan(
    (await card.boundingBox())!.width - 32,
  );

  await page
    .getByRole("button", { name: "Close map preview", exact: true })
    .click();
  await search.fill("Archive: board-game swap");
  await expect(
    results.getByRole("button", {
      name: "Open Archive: board-game swap Beacon",
      exact: true,
    }),
  ).toHaveCount(0);
  await search.fill("concert");
  await results
    .getByRole("button", {
      name: "Preview Lakefront Summer Lights concert public Beacon",
      exact: true,
    })
    .click();
  const preview = page.getByTestId("map-public-preview");
  await expect(preview).toContainText("41 going");
  await preview
    .getByRole("button", { name: "Close preview", exact: true })
    .click();
  await search.fill("photography");
  await results
    .getByRole("button", {
      name: "Preview Five-person street photography meetup public Beacon",
      exact: true,
    })
    .click();
  await expect(preview).toContainText("4 going");
  await preview.getByRole("button", { name: "Join", exact: true }).click();
  const joined = page.getByTestId("map-tooltip-card");
  await expect(joined).toContainText("5 going");
  expect(errors).toEqual([]);
});

test("friend preview keeps compact profile and message actions", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page
    .getByRole("textbox", {
      name: "Search places, Beacons, people and communities",
      exact: true,
    })
    .fill("Amara Reyes");
  await page
    .getByTestId("map-search-results")
    .getByRole("button", { name: "View Amara Reyes on map", exact: true })
    .click();
  const preview = page.getByTestId("map-person-preview");
  await expect(
    preview.getByRole("button", { name: "Message Amara Reyes", exact: true }),
  ).toBeVisible();
  await expect(preview.getByTestId("avatar-status-available")).toBeVisible();
  await expect(preview.getByText("Amara Reyes", { exact: true })).toHaveCSS(
    "text-align",
    "left",
  );
  const box = (await preview.boundingBox())!;
  expect(box.width).toBeLessThanOrEqual(320);
  expect(box.height).toBeLessThan(340);
  expect(
    (await preview
      .getByRole("button", { name: "View profile", exact: true })
      .boundingBox())!.width,
  ).toBeLessThan(200);
  const marker = page.getByRole("button", {
    name: /Map friend: Amara Reyes, available/,
  });
  await expect(marker.getByTestId("avatar-status-available")).toBeVisible();
  await preview
    .getByRole("button", { name: "View profile", exact: true })
    .click();
  await expect(
    page
      .getByTestId("avatar-status-available")
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
});

test("clusters stay compact, open the existing list, and become area summaries when zoomed out", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  const map = page.getByLabel("Beacon map", { exact: true }).locator("..");
  const cluster = map.getByRole("button", { name: /^Map cluster:/ }).first();
  await expect(cluster).toBeVisible();
  expect(await cluster.locator("img").count()).toBeLessThanOrEqual(3);
  await cluster.click();
  const panel = page.getByTestId("map-nearby-panel");
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("tab", { name: /People/ })).toBeVisible();
  await panel
    .getByRole("button", { name: "Close Nearby", exact: true })
    .click();
  await map.hover({ position: { x: 160, y: 400 } });
  await page.mouse.wheel(0, 700);
  const summary = map
    .getByRole("button", {
      name: /^Explore .+: .*(Friends?|Beacons?|happening now)/,
    })
    .first();
  await expect(summary).toBeVisible();
  await expect(map.getByRole("button", { name: /^Map cluster:/ })).toHaveCount(
    0,
  );
  expect(await summary.locator("img").count()).toBe(0);
  await summary.click();
  await expect(panel).toHaveCount(0);
  await expect(
    map.getByRole("button", { name: /^Map cluster:/ }).first(),
  ).toBeVisible();
});

test("close zoom keeps the empty-area hint off the map", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page
    .getByRole("textbox", {
      name: "Search places, Beacons, people and communities",
      exact: true,
    })
    .fill("Naperville");
  const results = page.getByTestId("map-search-results");
  await results
    .getByRole("button", { name: "Search worldwide places", exact: true })
    .click();
  await results
    .getByRole("button", { name: "Explore Naperville", exact: true })
    .click();
  await expect(page.getByTestId("map-discovery-help")).toContainText(
    "No Beacons here yet",
  );
  const map = page.getByLabel("Beacon map", { exact: true }).locator("..");
  await map.hover({ position: { x: 160, y: 400 } });
  await page.mouse.wheel(0, -700);
  await expect(page.getByTestId("map-discovery-help")).toHaveCount(0);
});
