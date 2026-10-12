import { test, expect } from "@playwright/test";

test("compact map controls anchor beside triggers, retain search, and never start location sharing", async ({
  page,
}) => {
  test.setTimeout(180_000);
  let weatherCalls = 0;
  await page.addInitScript(() => {
    localStorage.setItem(
      "beacon.map-device.v2",
      JSON.stringify({ hintsSeen: 3 }),
    );
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: () => {
          throw new Error("Unexpected location request");
        },
        watchPosition: () => {
          throw new Error("Unexpected sharing request");
        },
        clearWatch: () => {},
      },
    });
  });
  await page.route("https://api.open-meteo.com/**", (route) => {
    weatherCalls++;
    return route.fulfill({
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
    });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const demo = page.getByRole("button", { name: /Explore the demo/ });
  // The dev server serves a static button before React attaches its handlers.
  await expect
    .poll(
      () =>
        demo.evaluate((element) =>
          Object.keys(element).some((key) => key.startsWith("__reactProps$")),
        ),
      { timeout: 90_000 },
    )
    .toBe(true);
  await demo.click();
  const header = page.getByTestId("map-exploration-header");
  await expect(
    header.getByRole("button", { name: "Explore area", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Share location", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reset map north" }),
  ).toHaveCount(0);
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(
      header.getByRole("button", { name: "Now", exact: true }),
    ).toBeInViewport();
    await expect(
      header.getByRole("button", { name: "Filters", exact: true }),
    ).toBeInViewport();
    const navigation = page.getByRole("button", {
      name: "Navigation",
      exact: true,
    });
    await navigation.click({ timeout: 10_000 });
    const menu = page.getByTestId("map-navigation-popover");
    await expect(menu).toHaveCSS("opacity", "1");
    for (const name of [
      "Center on Me",
      "Return to Overview",
      "Explore Everywhere",
      "Pin a Location",
    ])
      await expect(
        menu.getByRole("button", { name, exact: true }),
      ).toBeVisible();
    const trigger = (await navigation.boundingBox())!;
    const bounds = (await menu.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(trigger.x);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
    await page.screenshot({
      path: `test-results/map-final-navigation-${viewport.width}.png`,
    });
    await page
      .getByRole("button", { name: "Map Display", exact: true })
      .click();
    await expect(menu).toHaveCount(0);
    await expect(
      page
        .getByTestId("map-map-display-popover")
        .getByRole("button", { name: "Standard map" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("map-map-display-popover")).toHaveCount(0);
  }
  const weather = page.getByRole("button", { name: "Weather", exact: true });
  await expect(weather).toContainText("72° Sunny");
  await weather.click();
  const conditions = page.getByTestId("map-weather-popover");
  await expect(conditions).toHaveCSS("opacity", "1");
  await expect(conditions.getByText("Feels like 70°F")).toBeVisible();
  const trigger = (await weather.boundingBox())!;
  const bounds = (await conditions.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(trigger.x);
  await page.screenshot({ path: "test-results/map-final-weather-390.png" });
  await page
    .getByTestId("map-toolbar-dismiss-area")
    .click({ position: { x: 6, y: 330 } });
  await expect(conditions).toHaveCount(0);
  expect(weatherCalls).toBeGreaterThan(0);
  await page.screenshot({ path: "test-results/map-final-controls-390.png" });
  await header
    .getByRole("button", { name: "Explore area", exact: true })
    .click();
  await expect(page.getByTestId("map-search-results")).toBeVisible();
});
