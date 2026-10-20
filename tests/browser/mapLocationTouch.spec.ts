import { expect, test, type CDPSession, type Page } from "@playwright/test";

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});

const menuName = "Actions for this map location";
const firstPoint = { x: 28, y: 430 };
const secondPoint = { x: 365, y: 650 };

async function demo(page: Page, path = "/") {
  await page.goto(path);
  await page.getByRole("button", { name: /Explore the demo/ }).tap();
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.locator(".leaflet-marker-icon").first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Navigation", exact: true }),
  ).toBeVisible();
  const hint = page.getByRole("button", { name: "Got it", exact: true });
  if (await hint.isVisible()) {
    await hint.tap();
    await expect(hint).toHaveCount(0);
  }
  return page.context().newCDPSession(page);
}

async function touch(
  session: CDPSession,
  type: "touchStart" | "touchMove" | "touchEnd",
  point?: { x: number; y: number },
) {
  await session.send("Input.dispatchTouchEvent", {
    type,
    touchPoints: point ? [{ ...point, radiusX: 1, radiusY: 1, force: 1 }] : [],
  });
}

async function hold(page: Page, session: CDPSession, point = firstPoint) {
  let previousLayout: string | undefined;
  await expect
    .poll(async () => {
      const layout = await page
        .locator(".leaflet-marker-icon")
        .evaluateAll((markers) =>
          JSON.stringify(
            markers.map((marker) => {
              const box = marker.getBoundingClientRect();
              return [Math.round(box.x), Math.round(box.y)];
            }),
          ),
        );
      const settled = layout === previousLayout;
      previousLayout = layout;
      return settled;
    })
    .toBe(true);
  const candidates = [
    point,
    ...[350, 430, 510, 590, 660, 710].flatMap((y) =>
      [28, 100, 180, 280, 365].map((x) => ({ x, y })),
    ),
  ];
  const findEmptyPoint = () =>
    page.evaluate((points) => {
      const controls = Array.from(
        document.querySelectorAll(
          "button, [role='button'], [role='menuitem'], .leaflet-marker-icon, .leaflet-control",
        ),
      );
      return points.find(({ x, y }) => {
        const target = document.elementFromPoint(x, y);
        return (
          !!target?.closest(".leaflet-container") &&
          !target.closest(
            ".leaflet-marker-icon, .leaflet-interactive, .leaflet-control",
          ) &&
          controls.every((control) => {
            if (
              !control.checkVisibility({
                checkOpacity: true,
                checkVisibilityCSS: true,
              })
            )
              return true;
            const box = control.getBoundingClientRect();
            return (
              !box.width ||
              !box.height ||
              Math.hypot(
                Math.max(box.left - x, 0, x - box.right),
                Math.max(box.top - y, 0, y - box.bottom),
              ) > 36
            );
          })
        );
      });
    }, candidates);
  await expect.poll(findEmptyPoint).toBeDefined();
  const emptyPoint = await findEmptyPoint();
  expect(
    emptyPoint,
    "a touch target safely away from markers and overlays",
  ).toBeDefined();
  const previous = (await page.getByTestId("map-temporary-pin").count())
    ? await page.getByTestId("map-temporary-pin").getAttribute("data-latitude")
    : null;
  await touch(session, "touchStart", emptyPoint!);
  if (previous) {
    await expect
      .poll(async () => {
        const pin = page.getByTestId("map-temporary-pin");
        return (
          (await pin.count()) === 1 &&
          (await pin.getAttribute("data-latitude")) !== previous
        );
      })
      .toBe(true);
  }
  await expect(page.getByRole("menu", { name: menuName })).toBeVisible();
  await touch(session, "touchEnd");
  await expect(page.getByRole("menu", { name: menuName })).toBeVisible();
  const pin = page.getByTestId("map-temporary-pin");
  await expect(pin).toHaveCount(1);
  return {
    latitude: Number(await pin.getAttribute("data-latitude")),
    longitude: Number(await pin.getAttribute("data-longitude")),
  };
}

test("touch taps and pans stay ordinary; long holds select, update and dismiss a temporary location", async ({
  page,
}) => {
  const session = await demo(page);
  const menu = page.getByRole("menu", { name: menuName });
  await page.touchscreen.tap(firstPoint.x, firstPoint.y);
  await expect(menu).toHaveCount(0);
  await expect(page.getByTestId("map-temporary-pin")).toHaveCount(0);

  await touch(session, "touchStart", { x: 28, y: 590 });
  await touch(session, "touchMove", { x: 28, y: 555 });
  await touch(session, "touchMove", { x: 28, y: 520 });
  await touch(session, "touchEnd");
  await expect(menu).toHaveCount(0);

  const first = await hold(page, session);
  await expect(page.getByTestId("map-place-preview-slot")).toHaveCount(0);
  const bounds = await menu.boundingBox();
  expect(bounds!.width).toBeLessThanOrEqual(304);
  expect(bounds!.x).toBeGreaterThanOrEqual(16);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(374);
  expect(bounds!.y + bounds!.height).toBeLessThan(772);
  const camera = await page.locator(".leaflet-map-pane").getAttribute("style");
  await page.screenshot({ path: "test-results/map-location-touch-menu.png" });
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(page.getByTestId("map-temporary-pin")).toHaveCount(0);
  await expect(page.getByTestId("map-place-preview-slot")).toHaveCount(0);
  await expect(page.locator(".leaflet-map-pane")).toHaveAttribute(
    "style",
    camera!,
  );

  await hold(page, session);
  const second = await hold(page, session, secondPoint);
  expect(second).not.toEqual(first);
  await page.touchscreen.tap(28, 700);
  await expect(menu).toHaveCount(0);
  await expect(page.getByTestId("map-temporary-pin")).toHaveCount(0);
  await expect(page.getByTestId("map-place-preview-slot")).toHaveCount(0);
});

test("a full action row opens template-first creation with the exact held coordinate", async ({
  page,
}) => {
  const session = await demo(page);
  await page.getByRole("button", { name: "Filters", exact: true }).tap();
  const filters = page.getByRole("dialog", { name: "Filters", exact: true });
  await filters.getByRole("checkbox", { name: "Study", exact: true }).tap();
  await filters.getByRole("button", { name: /^Show \d+ Beacons$/ }).tap();
  await expect(filters).toHaveCount(0);
  const coordinate = await hold(page, session);
  const create = page.getByRole("menuitem", {
    name: "Create a Beacon. Plan an activity here",
    exact: true,
  });
  const row = await create.boundingBox();
  await create.tap({ position: { x: row!.width - 12, y: row!.height / 2 } });
  await expect(
    page.getByRole("button", { name: "Create Blank Template", exact: true }),
  ).toBeVisible();
  const params = new URL(page.url()).searchParams;
  expect(Number(params.get("latitude"))).toBe(coordinate.latitude);
  expect(Number(params.get("longitude"))).toBe(coordinate.longitude);
  await page
    .getByRole("textbox", { name: "Search activities", exact: true })
    .fill("Study together");
  await page.getByRole("button", { name: "Study together", exact: true }).tap();
  await expect(
    page.getByRole("textbox", { name: "Title / Activity", exact: true }),
  ).toHaveValue("Study together");
  await expect(
    page.getByRole("textbox", { name: "Where? (optional)", exact: true }),
  ).toHaveValue("Area Update");
  await page
    .getByRole("button", { name: "Advanced Options ↓", exact: true })
    .tap();
  await expect(
    page.getByRole("button", { name: "Edit meeting pin", exact: true }),
  ).toBeVisible();
});

test("place taps keep their preview and Pulse context; directions use the exact temporary pin", async ({
  page,
}) => {
  const session = await demo(page);
  await page
    .getByRole("textbox", {
      name: "Search places, Beacons, people and communities",
      exact: true,
    })
    .fill("Riverbend Cafe");
  await page
    .getByRole("button", { name: "Explore Riverbend Cafe", exact: true })
    .tap();
  const preview = page.getByTestId("live-update-place-preview");
  await expect(preview).toContainText("Riverbend Cafe");
  await expect(page.getByRole("menu", { name: menuName })).toHaveCount(0);
  await expect(
    preview.getByRole("button", { name: "Directions", exact: true }),
  ).toBeVisible();
  await preview.getByRole("button", { name: "Update", exact: true }).tap();
  await expect(page.getByTestId("add-live-update-sheet")).toContainText(
    "Riverbend Cafe",
  );
  await page.getByRole("button", { name: "Close", exact: true }).tap();
  await expect(page.getByTestId("add-live-update-sheet")).toHaveCount(0);
  await preview
    .getByRole("button", { name: "Close place preview", exact: true })
    .tap();
  await expect(preview).toHaveCount(0);

  await hold(page, session);
  const pulse = page.getByRole("menuitem", {
    name: "Share a Pulse. What's happening here?",
    exact: true,
  });
  const row = await pulse.boundingBox();
  await pulse.tap({ position: { x: row!.width - 12, y: row!.height / 2 } });
  await expect(page.getByTestId("add-live-update-sheet")).toContainText(
    "Area Update",
  );
  await expect(page.getByTestId("map-temporary-pin")).toHaveCount(0);
  await page.getByRole("button", { name: "Close", exact: true }).tap();
  await expect(page.getByTestId("add-live-update-sheet")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Close place preview", exact: true })
    .tap();
  await expect(preview).toHaveCount(0);

  const coordinate = await hold(page, session);
  await page
    .context()
    .route("https://www.google.com/maps/dir/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "Directions",
      }),
    );
  const request = page
    .context()
    .waitForEvent("request", (value) =>
      /google\.com\/maps\/dir\//.test(value.url()),
    );
  await page
    .getByRole("menuitem", {
      name: "Get Directions. Open in your maps app",
      exact: true,
    })
    .tap();
  expect(new URL((await request).url()).searchParams.get("destination")).toBe(
    `${coordinate.latitude},${coordinate.longitude}`,
  );
  await expect(page.getByTestId("map-temporary-pin")).toHaveCount(0);
});

test("closing a temporary selection preserves filters, Plan context and the camera", async ({
  page,
}) => {
  const session = await demo(
    page,
    "/?beacon=demo-routine%3Ademo-you%3Afriday%3Aplan%3Abeacon%3A2",
  );
  await page
    .getByTestId("map-tooltip-card")
    .getByRole("button", { name: "See overview", exact: true })
    .tap();
  const panel = page.getByTestId("map-panel");
  await panel.getByRole("button", { name: /^Show Plan / }).tap();
  await expect(panel).toHaveCount(0);
  const context = page.getByRole("button", {
    name: /^Remove Plan: Friday Night Routine/,
  });
  await expect(context).toBeVisible();
  await page.getByTestId("map-filter-toggle").tap();
  const filters = page.getByRole("dialog", { name: "Filters", exact: true });
  await filters.getByRole("checkbox", { name: "Study", exact: true }).tap();
  await filters.getByRole("button", { name: /^Show \d+ Beacons$/ }).tap();
  await expect(filters).toHaveCount(0);
  await hold(page, session);
  const camera = await page.locator(".leaflet-map-pane").getAttribute("style");
  await page
    .getByRole("button", { name: "Close location actions", exact: true })
    .tap();
  await expect(page.getByTestId("map-temporary-pin")).toHaveCount(0);
  await expect(context).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Remove Study filter", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".leaflet-map-pane")).toHaveAttribute(
    "style",
    camera!,
  );
});
