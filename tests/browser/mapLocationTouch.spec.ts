import { mockOnboardingAccount } from "./onboardingAccount";
import { makeDemo } from "../../src/shared/demo";
import { expect, test, type CDPSession, type Page } from "@playwright/test";

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});

const firstPoint = { x: 28, y: 430 };
const secondPoint = { x: 365, y: 650 };

test.beforeEach(async ({ page }) => {
  await page.routeWebSocket("**/hot", () => {});
  await page.routeWebSocket("**/message", () => {});
});

async function demo(page: Page, path = "/") {
  await page.goto(path);
  const enterDemo = page.getByRole("button", { name: /Explore the demo/ });
  await expect
    .poll(
      () =>
        enterDemo.evaluate((element) =>
          Object.keys(element).some((key) => key.startsWith("__reactProps$")),
        ),
      { timeout: 90000 },
    )
    .toBe(true);
  await enterDemo.tap();
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
  await expect(page.getByTestId("map-place-actions")).toBeVisible();
  await touch(session, "touchEnd");
  await expect(page.getByTestId("map-place-actions")).toBeVisible();
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
  const menu = page.getByTestId("map-place-actions");
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

// Creation, named-place activity and exact directions journeys are covered by mapUnifiedPlace.spec.ts.

test("closing a temporary selection preserves filters, Plan context and the camera", async ({
  page,
}) => {
  const account = await mockOnboardingAccount(page, { eligible: false });
  const viewer = account.snapshot.viewer_id!;
  account.snapshot.capabilities = {
    ...account.snapshot.capabilities,
    living_plans: false,
  };
  account.snapshot.plans.push({
    id: "held-place-plan",
    owner_id: viewer,
    squad_id: null,
    title: "Held place itinerary",
    description: "",
    timezone: "America/Chicago",
    start_date: "2026-11-04",
    status: "scheduled",
    created_at: new Date().toISOString(),
  });
  const base = makeDemo().activities[0];
  for (const [index, id] of ["held-stop-one", "held-stop-two"].entries()) {
    account.snapshot.activities.push({
      ...base,
      id,
      owner_id: viewer,
      audience: "private",
      audience_id: null,
      plan_id: "held-place-plan",
      plan_step_index: index,
      viewer_can_access: true,
      viewer_can_read: true,
      starts_at: new Date(Date.now() + 3600000).toISOString(),
      ends_at: new Date(Date.now() + 7200000).toISOString(),
    });
    account.snapshot.places.push({
      activity_id: id,
      label: "Authorized stop",
      latitude: 41.88 + 0.02 * index,
      longitude: -87.63,
      online_url: null,
    });
  }
  await page.goto("/?mapPlan=held-place-plan");
  const context = page.getByTestId("map-plan-focus");
  await expect(context).toContainText("2 visible physical stops");
  const session = await page.context().newCDPSession(page);
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
