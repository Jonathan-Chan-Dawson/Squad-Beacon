import { expect, test, type Page } from "@playwright/test";

async function demo(page: Page, path = "/") {
  await page.addInitScript(() =>
    localStorage.setItem(
      "beacon.map-device.v2",
      JSON.stringify({ hintsSeen: 3 }),
    ),
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
    await selector
      .getByRole("button", { name: "Friends", exact: true })
      .click();
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
    const navigation = page.getByRole("button", {
      name: "Navigation",
      exact: true,
    });
    await navigation.click();
    await page.getByRole("button", { name: "My Beacons", exact: true }).click();
    const sheet = page.getByRole("dialog", { name: "My Beacons", exact: true });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText("Hosting", { exact: true })).toBeVisible();
    await sheet.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "Filters", exact: true }).click();
    const filters = page.getByTestId("advanced-map-filters");
    await expect(filters).toBeVisible();
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

test("My Beacons reaches a hosted Beacon outside filters and restores the filtered view", async ({ page }) => {
  await demo(page);
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  const filters = page.getByRole("dialog", { name: "Filters", exact: true });
  await filters.getByRole("button", { name: "Gaming", exact: true }).click();
  await filters.getByRole("button", { name: /^Show \d+ Beacons$/ }).click();
  const gaming = page.getByRole("button", { name: "Remove Gaming filter", exact: true });
  await expect(gaming).toBeVisible();
  await page.getByRole("button", { name: "Navigation", exact: true }).click();
  await page.getByRole("button", { name: "My Beacons", exact: true }).click();
  await page.getByRole("dialog", { name: "My Beacons", exact: true }).getByRole("button", { name: /^Plan stop 1: Coffee together · / }).click();
  const context = page.getByRole("button", { name: "Remove Beacon: Plan stop 1: Coffee together filter", exact: true });
  await expect(context).toBeVisible();
  await expect(page.locator('button[aria-label^="Map: Plan stop 1: Coffee together"]')).toBeVisible();
  await expect(gaming).toBeVisible();
  await context.click();
  await expect(context).toHaveCount(0);
  await expect(gaming).toBeVisible();
});
