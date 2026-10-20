import { expect, test, type Page } from "@playwright/test";

async function demo(page: Page, path = "/") {
  await page.addInitScript(() =>
    localStorage.setItem(
      "beacon.map-device.v2",
      JSON.stringify({ hintsSeen: 3 }),
    ),
  );
  await page.addInitScript(
    (appearance) => localStorage.setItem("beacon.appearance", appearance),
    page.viewportSize()?.width === 375 ? "light" : "dark",
  );
  await page.goto(path);
  const enter = page.getByRole("button", { name: /Explore the demo/ });
  await expect
    .poll(
      () =>
        enter.evaluate((node) =>
          Object.keys(node).some((key) => key.startsWith("__reactProps$")),
        ),
      { timeout: 90_000 },
    )
    .toBe(true);
  await enter.click();
}

for (const width of [320, 375, 430]) {
  test(`selector preserves selections and compact controls at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 900 });
    await demo(page, "/friends");
    const screen = page.getByTestId("friends-screen");
    const selector = screen.getByTestId("social-selector");
    await expect(selector).toBeVisible();
    expect((await selector.getByRole("button", { name: "All", exact: true }).boundingBox())!.width).toBeGreaterThanOrEqual(44);
    await page.emulateMedia({ colorScheme: width === 375 ? "light" : "dark" });
    await selector
      .getByRole("button", { name: "Friends", exact: true })
      .click();
    const privateLists = selector.getByTestId("friends-private-lists");
    await expect(privateLists).toHaveCSS("border-top-width", "1px");
    await expect(
      privateLists.getByRole("button", { name: "Manage Private Lists" }),
    ).toBeVisible();
    await expect(
      selector.getByRole("button", { name: "Friends", exact: true }),
    ).toHaveCSS("border-bottom-width", "2px");
    await page.screenshot({ path: `.expo/menu-polish/friends-${width}.png` });
    const select = screen
      .getByRole("button", { name: /^Select .+ for planning$/ })
      .first();
    await select.scrollIntoViewIfNeeded();
    const dimensions = await select.evaluate((node) => {
      const target = node.getBoundingClientRect();
      const face = node.firstElementChild!.getBoundingClientRect();
      return {
        target: [target.width, target.height],
        face: [face.width, face.height],
      };
    });
    expect(dimensions.target).toEqual([44, 44]);
    expect(dimensions.face).toEqual([28, 28]);
    await select.click();
    await expect(
      screen.getByRole("button", { name: "Plan with 1", exact: true }),
    ).toBeVisible();
    await selector
      .getByLabel("Search people and groups", { exact: true })
      .fill("no-match-example");
    await expect(
      screen.getByRole("button", { name: "Plan with 1", exact: true }),
    ).toBeVisible();
    await selector
      .getByRole("button", { name: "Super-Organizations", exact: true })
      .click();
    await expect(
      selector.getByRole("button", {
        name: "Super-Organizations",
        exact: true,
      }),
    ).toBeInViewport();
    await expect(
      screen.getByRole("button", { name: "Plan with 1", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });

  test(`My Beacons, Filters and Weather stay usable at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 900 });
    await page.route("https://api.open-meteo.com/**", (route) =>
      route.fulfill({
        json: {
          current: {
            temperature_2m: 72,
            apparent_temperature: 70,
            relative_humidity_2m: 45,
            wind_speed_10m: 5,
            weather_code: 0,
            is_day: 1,
          },
        },
      }),
    );
    await demo(page);
    const labelTiles = page.locator(".beacon-basemap-labels img.leaflet-tile");
    if (width === 375) await expect(labelTiles).toHaveCount(0);
    else {
      await expect(labelTiles.first()).toBeAttached();
      await expect(labelTiles.first()).toHaveCSS(
        "filter",
        "brightness(1.65) contrast(1.05)",
      );
    }
    await expect
      .poll(
        () =>
          page
            .locator("img.leaflet-tile")
            .evaluateAll((images) =>
              images.some(
                (image) =>
                  (image as HTMLImageElement).complete &&
                  (image as HTMLImageElement).naturalWidth > 0,
              ),
            ),
        { timeout: 30000 },
      )
      .toBe(true);
    await page.screenshot({ path: `.expo/menu-polish/map-${width}.png` });
    const navigation = page.getByRole("button", {
      name: "Navigation",
      exact: true,
    });
    await navigation.click();
    await page.getByRole("button", { name: "My Beacons", exact: true }).click();
    const sheet = page.getByRole("dialog", { name: "My Beacons", exact: true });
    await expect(sheet).toBeVisible();
    const hosting = sheet.getByRole("tab", { name: /^Hosting \(/ });
    const joined = sheet.getByRole("tab", { name: /^Joined \(/ });
    await expect(hosting).toBeVisible();
    await expect(hosting).toHaveAttribute("aria-selected", "true");
    await joined.click();
    await expect(joined).toHaveAttribute("aria-selected", "true");
    await page.screenshot({ path: `.expo/menu-polish/joined-${width}.png` });
    await hosting.click();
    await expect(hosting).toHaveAttribute("aria-selected", "true");
    expect((await hosting.boundingBox())!.y).toBeGreaterThanOrEqual(
      900 * 0.3 - 2,
    );
    await page.screenshot({ path: `.expo/menu-polish/hosting-${width}.png` });
    await sheet.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "Filters", exact: true }).click();
    const filters = page.getByTestId("advanced-map-filters");
    await expect(filters).toBeVisible();
    const when = filters.getByRole("radiogroup", { name: "When", exact: true });
    await when.getByRole("radio", { name: "Tomorrow", exact: true }).click();
    await expect(
      when.getByRole("radio", { name: "Tomorrow", exact: true }),
    ).toBeChecked();
    const grid = filters.getByTestId("filter-category-grid");
    const cells = await grid.getByRole("checkbox").all();
    const left = (await cells[0].boundingBox())!;
    const right = (await cells[1].boundingBox())!;
    expect(left.y).toBe(right.y);
    expect(right.x).toBeGreaterThan(left.x + left.width);
    expect(left.height).toBeGreaterThanOrEqual(44);
    await cells[0].click();
    await expect(cells[0]).toBeChecked();
    await page.screenshot({ path: `.expo/menu-polish/filters-${width}.png` });
    await filters
      .getByRole("button", { name: "More filters", exact: true })
      .click();
    const format = filters.getByRole("radiogroup", {
      name: "Format",
      exact: true,
    });
    await format.getByRole("radio", { name: "Virtual", exact: true }).click();
    await expect(
      format.getByRole("radio", { name: "Virtual", exact: true }),
    ).toBeChecked();
    await page
      .getByRole("dialog", { name: "Filters", exact: true })
      .getByRole("button", { name: "Reset filters", exact: true })
      .click();
    await expect(
      when.getByRole("radio", { name: "Any", exact: true }),
    ).toBeChecked();
    await expect(cells[0]).not.toBeChecked();
    const show = page.getByRole("button", { name: /^Show \d+ Beacons$/ });
    await expect(show).toBeVisible();
    await show.click();
    await expect(
      page.getByRole("button", { name: "Weather", exact: true }),
    ).toContainText("Weather");
  });
}

test("Chats separates existing conversations from friends and Add Friends", async ({
  page,
}) => {
  await demo(page, "/squads");
  const divider = page.getByTestId("chat-friends-divider");
  await expect(divider).toBeVisible();
  await expect(divider).toHaveCSS("border-top-width", "1px");
  await divider
    .getByRole("button", { name: "Find/Add Friends", exact: true })
    .click();
  await expect(page).toHaveURL(/\/find-friends$/);
});

test("My Beacons reaches a hosted Beacon outside filters and restores the filtered view", async ({
  page,
}) => {
  await demo(page);
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  const filters = page.getByRole("dialog", { name: "Filters", exact: true });
  await filters.getByRole("checkbox", { name: "Gaming", exact: true }).click();
  await filters.getByRole("button", { name: /^Show \d+ Beacons$/ }).click();
  const gaming = page.getByRole("button", {
    name: "Remove Gaming filter",
    exact: true,
  });
  await expect(gaming).toBeVisible();
  await page.getByRole("button", { name: "Navigation", exact: true }).click();
  await page.getByRole("button", { name: "My Beacons", exact: true }).click();
  await page
    .getByRole("dialog", { name: "My Beacons", exact: true })
    .getByRole("button", { name: /^Plan stop 1: Coffee together · / })
    .click();
  const context = page.getByRole("button", {
    name: "Remove Beacon: Plan stop 1: Coffee together filter",
    exact: true,
  });
  await expect(context).toBeVisible();
  await expect(
    page.locator('button[aria-label^="Map: Plan stop 1: Coffee together"]'),
  ).toBeVisible();
  await expect(gaming).toBeVisible();
  await context.click();
  await expect(context).toHaveCount(0);
  await expect(gaming).toBeVisible();
});

test("private list initials, management separation and selections persist with a long name", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await demo(page, "/friends");
  const screen = page.getByTestId("friends-screen");
  await screen.getByRole("button", { name: "Friends", exact: true }).click();
  await screen
    .getByRole("button", { name: /^Select .+ for planning$/ })
    .first()
    .click();
  await screen
    .getByRole("button", { name: "Manage Private Lists", exact: true })
    .click();
  const lists = page.getByRole("dialog", {
    name: "Private Lists",
    exact: true,
  });
  await expect(lists.getByTestId("private-lists-divider")).toHaveCSS(
    "border-top-width",
    "1px",
  );
  await lists.getByRole("button", { name: "Create List", exact: true }).click();
  const create = page.getByRole("dialog", {
    name: "Create private list",
    exact: true,
  });
  const name = "Weekend Explorers and Very Long Named Friends";
  await create.getByLabel("List name", { exact: true }).fill(name);
  await create.getByRole("button", { name: "Create", exact: true }).click();
  const row = lists.getByRole("button", {
    name: `Filter chats by ${name}`,
    exact: true,
  });
  await expect(row.getByTestId(/^private-list-icon-/)).toHaveText("W");
  await expect(
    lists.getByRole("img", { name: "Close Friends list", exact: true }),
  ).toBeVisible();
  await row.click();
  const list = screen.getByRole("button", { name, exact: true });
  await expect(list).toHaveAttribute("aria-pressed", "true");
  await expect(
    screen.getByRole("button", { name: "Plan with 1", exact: true }),
  ).toBeVisible();
  await screen.getByRole("button", { name: "Squads", exact: true }).click();
  await screen.getByRole("button", { name: "Friends", exact: true }).click();
  await expect(list).toHaveAttribute("aria-pressed", "true");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
