import { expect, test, type Page } from "@playwright/test";
const labels = [
  "Create Beacon",
  "Start Ping",
  "Add live update",
  "Directions",
  "Search location",
];
async function enter(page: Page, width = 390, dark = false) {
  await page.setViewportSize({ width, height: 844 });
  await page.addInitScript(
    ({ dark }) => {
      localStorage.setItem("beacon.appearance", dark ? "dark" : "light");
      localStorage.setItem(
        "beacon.map-device.v2",
        JSON.stringify({ hintsSeen: 3 }),
      );
    },
    { dark },
  );
  await page.routeWebSocket("**/hot", () => {});
  await page.routeWebSocket("**/message", () => {});
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await expect(
    page.getByRole("button", { name: "Choose a place", exact: true }),
  ).toBeVisible();
}
async function choose(page: Page) {
  await page
    .getByRole("button", { name: "Choose a place", exact: true })
    .click();
  await expect(page.getByTestId("map-place-instructions")).toContainText(
    "Tap the map to choose a place.",
  );
  await page
    .locator(".leaflet-container")
    .click({ position: { x: 100, y: 360 }, force: true });
  await expect(page.getByTestId("map-place-actions")).toBeVisible();
}
async function camera(page: Page) {
  return page.locator(".leaflet-proxy").getAttribute("style");
}
for (const width of [320, 375, 390, 430, 1280])
  test(`unified place menu stays bounded at ${width}px`, async ({ page }) => {
    await enter(page, width, width === 375);
    await choose(page);
    const menu = page.getByTestId("map-place-actions");
    for (const label of labels)
      await expect(
        menu.getByRole("button", { name: label, exact: true }),
      ).toBeVisible();
    const directions = menu.getByRole("button", {
      name: "Directions",
      exact: true,
    });
    await expect(directions).toHaveAttribute(
      "title",
      "Get directions · opens Google Maps.",
    );
    const control = (await directions.boundingBox())!,
      badge = (await menu
        .getByTestId("locator-directions-external")
        .boundingBox())!;
    expect(control.width).toBeGreaterThanOrEqual(44);
    expect(control.height).toBeGreaterThanOrEqual(44);
    expect(badge.width).toBe(12);
    expect(badge.height).toBe(12);
    expect(badge.x).toBeGreaterThan(control.x + control.width / 2);
    expect(control.y).toBeGreaterThan(
      (await menu
        .getByRole("button", { name: "Add live update", exact: true })
        .boundingBox())!.y,
    );
    expect(badge.x + badge.width).toBeLessThanOrEqual(
      control.x + control.width,
    );
    expect(badge.y + badge.height).toBeLessThanOrEqual(
      control.y + control.height,
    );
    await expect(
      menu.getByTestId("locator-directions-external"),
    ).toHaveAttribute("aria-hidden", "true");
    await expect(
      directions.locator('button, a, input, [tabindex="0"]'),
    ).toHaveCount(0);
    const box = (await menu.boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(288);
    expect(box.x).toBeGreaterThanOrEqual(12);
    expect(box.x + box.width).toBeLessThanOrEqual(width - 12);
    expect(box.y + box.height).toBeLessThanOrEqual(844);
    await page.screenshot({
      path: test.info().outputPath(`place-menu-${width}.png`),
    });
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(page.getByTestId("map-temporary-pin")).toHaveCount(0);
  });
test("hold and choose-place share actions and outside dismissal preserves camera", async ({
  page,
}) => {
  await enter(page);
  await choose(page);
  const menu = page.getByTestId("map-place-actions");
  const before = await camera(page);
  await expect(
    menu.getByRole("button", { name: "Move pin", exact: true }),
  ).toHaveCount(0);
  await expect(
    menu.getByRole("button", { name: "Nearby Beacons", exact: true }),
  ).toHaveCount(0);
  const directions = (await menu
    .getByRole("button", { name: "Directions", exact: true })
    .boundingBox())!;
  const search = (await menu
    .getByRole("button", { name: "Search location", exact: true })
    .boundingBox())!;
  expect(search.y).toBeLessThan(directions.y);
  await menu
    .getByRole("button", { name: "Close location actions", exact: true })
    .click();
  await expect(menu).toHaveCount(0);
  await expect(page.getByTestId("map-place-menu")).toHaveCount(0);
  await expect(page.getByTestId("map-temporary-pin")).toHaveCount(0);
  const holdPoint = await page.locator(".leaflet-container").evaluate((map) => {
    const box = map.getBoundingClientRect();
    for (const y of [360, 430, 510, 590])
      for (const x of [30, 100, 180, 280]) {
        const target = document.elementFromPoint(box.x + x, box.y + y);
        if (
          target?.closest(".leaflet-container") &&
          !target.closest(
            ".leaflet-marker-icon,.leaflet-interactive,.leaflet-control,button,[role=button]",
          )
        )
          return { x, y };
      }
    throw new Error("No empty Map position for hold");
  });
  await page
    .locator(".leaflet-container")
    .click({ button: "right", position: holdPoint });
  await expect(menu).toBeVisible();
  for (const label of labels)
    await expect(
      menu.getByRole("button", { name: label, exact: true }),
    ).toBeVisible();
  await page
    .locator(".leaflet-container")
    .click({ position: { x: 10, y: 650 }, force: true });
  await expect(menu).toHaveCount(0);
  expect(await camera(page)).toBe(before);
});
test("search replaces the selected place and Ping uses the existing creation route", async ({
  page,
}) => {
  await enter(page);
  await choose(page);
  const menu = page.getByTestId("map-place-actions");
  await menu
    .getByRole("button", { name: "Search location", exact: true })
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
  await expect(menu).toContainText("Chicago");
  await menu.getByRole("button", { name: "Start Ping", exact: true }).click();
  await expect
    .poll(() => new URL(page.url()).pathname)
    .toBe("/planning/create");
  expect(new URL(page.url()).searchParams.get("kind")).toBe("ping");
  expect(new URL(page.url()).searchParams.get("latitude")).toBeTruthy();
});
test("live update returns to the same place menu", async ({ page }) => {
  await enter(page);
  await choose(page);
  const menu = page.getByTestId("map-place-actions");
  await menu
    .getByRole("button", { name: "Add live update", exact: true })
    .click();
  await expect(page.getByTestId("add-live-update-sheet")).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(menu).toBeVisible();
});

test("short phone and reduced motion keep the pin clear and all actions reachable", async ({
  page,
}) => {
  await enter(page, 320);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await choose(page);
  const menu = page.getByTestId("map-place-actions"),
    pin = page.getByTestId("map-temporary-pin");
  await expect
    .poll(async () => {
      const box = (await menu.boundingBox())!,
        point = (await pin.boundingBox())!;
      return {
        clear: box.y + box.height <= point.y || box.y >= point.y + point.height,
        menu: box,
        pin: point,
      };
    })
    .toMatchObject({ clear: true });
  await menu
    .getByRole("button", { name: "Search location", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Search location", exact: true }),
  ).toBeVisible();
});

test.describe("touch hold", () => {
  test.use({ hasTouch: true, isMobile: true });
  test("holding empty Map space opens the same menu without a follow-up tap", async ({
    page,
  }) => {
    await enter(page);
    const map = page.locator(".leaflet-container");
    const point = await map.evaluate((node) => {
      const box = node.getBoundingClientRect();
      for (const y of [350, 450, 550])
        for (const x of [30, 100, 200]) {
          const target = document.elementFromPoint(box.x + x, box.y + y);
          if (
            target?.closest(".leaflet-container") &&
            !target.closest(
              ".leaflet-marker-icon,.leaflet-interactive,.leaflet-control,button,[role=button]",
            )
          )
            return { x: box.x + x, y: box.y + y };
        }
      throw new Error("No empty Map space");
    });
    const session = await page.context().newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ ...point, radiusX: 1, radiusY: 1, force: 1 }],
    });
    const menu = page.getByTestId("map-place-actions");
    await expect(menu).toBeVisible();
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect(menu).toBeVisible();
    await expect(
      menu.getByRole("button", { name: "Create Beacon", exact: true }),
    ).toBeVisible();
  });
});

test("Create Beacon retains the selected location through template-first creation", async ({
  page,
}) => {
  await enter(page);
  await choose(page);
  const pin = page.getByTestId("map-temporary-pin");
  const latitude = await pin.getAttribute("data-latitude"),
    longitude = await pin.getAttribute("data-longitude");
  await page
    .getByTestId("map-place-actions")
    .getByRole("button", { name: "Create Beacon", exact: true })
    .click();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/create");
  expect(new URL(page.url()).searchParams.get("latitude")).toBe(latitude);
  expect(new URL(page.url()).searchParams.get("longitude")).toBe(longitude);
  await expect(
    page.getByRole("button", { name: "+ Create Blank Beacon", exact: true }),
  ).toBeVisible();
});

test("named places retain their activity disclosure and live-update identity", async ({
  page,
}) => {
  await enter(page);
  await page
    .getByRole("textbox", {
      name: "Search places, Beacons, people and communities",
      exact: true,
    })
    .fill("Riverbend Cafe");
  await page
    .getByRole("button", { name: "Explore Riverbend Cafe", exact: true })
    .click();
  const menu = page.getByTestId("map-place-actions");
  await expect(menu).toContainText("Riverbend Cafe");
  await menu
    .getByRole("button", { name: "Place activity", exact: true })
    .click();
  await expect(menu.getByTestId("live-update-place-preview")).toBeVisible();
  await menu
    .getByRole("button", { name: "Add live update", exact: true })
    .click();
  await expect(page.getByTestId("add-live-update-sheet")).toContainText(
    "Riverbend Cafe",
  );
});

test("Directions uses the exact selected pin, then dismisses it", async ({
  page,
}) => {
  await enter(page);
  await choose(page);
  const pin = page.getByTestId("map-temporary-pin");
  const latitude = await pin.getAttribute("data-latitude"),
    longitude = await pin.getAttribute("data-longitude");
  let navigations = 0;
  await page.context().route("https://www.google.com/maps/dir/**", (route) => {
    navigations++;
    return route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "Directions",
    });
  });
  const request = page
    .context()
    .waitForEvent("request", (value) =>
      value.url().startsWith("https://www.google.com/maps/dir/"),
    );
  const directions = page
    .getByTestId("map-place-actions")
    .getByRole("button", { name: "Directions", exact: true });
  const badge = (await page
      .getByTestId("locator-directions-external")
      .boundingBox())!,
    control = (await directions.boundingBox())!;
  await directions.click({
    position: {
      x: badge.x + badge.width / 2 - control.x,
      y: badge.y + badge.height / 2 - control.y,
    },
  });
  expect(new URL((await request).url()).searchParams.get("destination")).toBe(
    `${latitude},${longitude}`,
  );
  await expect(pin).toHaveCount(0);
  expect(navigations).toBe(1);
});
