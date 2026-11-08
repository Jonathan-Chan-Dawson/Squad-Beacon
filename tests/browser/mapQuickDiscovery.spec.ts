import { expect, test, type Page } from "@playwright/test";
import { mockOnboardingAccount } from "./onboardingAccount";
import { makeDemo } from "../../src/shared/demo";

async function enter(page: Page, width = 390, dark = false, reduced = false) {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  await page.addInitScript(
    ({ dark }) => {
      localStorage.setItem("beacon.appearance", dark ? "dark" : "light");
      localStorage.setItem(
        "beacon.map-device.v2",
        JSON.stringify({
          hintsSeen: 3,
          camera: {
            center: { latitude: 41.885, longitude: -87.642 },
            zoom: 13,
            bounds: { north: 41.93, south: 41.84, west: -87.7, east: -87.58 },
          },
        }),
      );
    },
    { dark },
  );
  await page.routeWebSocket("**/hot", () => {});
  await page.routeWebSocket("**/message", () => {});
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await expect(page.getByTestId("map-surprise")).toBeEnabled({
    timeout: 20000,
  });
  let previous = "",
    stable = 0;
  await expect
    .poll(
      async () => {
        const next = await camera(page);
        stable = previous === next ? stable + 1 : 0;
        previous = next;
        return stable;
      },
      { intervals: [150], timeout: 15000 },
    )
    .toBeGreaterThanOrEqual(3);
}

async function camera(page: Page) {
  return page
    .locator(".leaflet-container")
    .evaluate((node) =>
      JSON.stringify([
        node.querySelector(".leaflet-proxy")?.getAttribute("style"),
      ]),
    );
}

async function interests(page: Page) {
  await page
    .getByTestId("map-exploration-header")
    .getByRole("button", { name: /^Interests/ })
    .click();
  return page.getByTestId("map-interests-popover");
}

test("Friends, categories and Now combine; All preserves time and advanced restrictions", async ({
  page,
}) => {
  await enter(page);
  const header = page.getByTestId("map-exploration-header"),
    before = await camera(page);
  await header.getByRole("button", { name: "Friends", exact: true }).click();
  await header
    .getByRole("button", { name: "Happening now", exact: true })
    .click();
  await expect(
    header.getByRole("button", { name: "Happening now", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const menu = await interests(page);
  await menu.getByRole("checkbox", { name: "Study", exact: true }).click();
  await expect(
    menu.getByRole("checkbox", { name: "Study", exact: true }),
  ).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(
    header.getByRole("button", { name: /^Interests/ }),
  ).toBeFocused();
  await expect(
    header.getByRole("button", { name: "Remove Study filter", exact: true }),
  ).toBeVisible();
  await page.getByTestId("map-filter-toggle").click();
  const advanced = page.getByTestId("advanced-map-filters");
  await expect(
    advanced.getByRole("checkbox", { name: "Study", exact: true }),
  ).toBeChecked();
  await advanced.getByRole("radio", { name: "Tomorrow", exact: true }).click();
  // Upcoming + Now is incompatible even when an active Beacon spans midnight.
  await advanced
    .getByRole("button", { name: "More filters", exact: true })
    .click();
  await advanced.getByRole("button", { name: "Upcoming", exact: true }).click();
  await page.getByRole("button", { name: /^Show \d+ Beacons$/ }).click();
  await expect(
    page.getByRole("dialog", { name: "Filters", exact: true }),
  ).toHaveCount(0);
  await header.getByRole("button", { name: "All", exact: true }).click();
  await expect(
    header.getByRole("button", { name: "Remove Tomorrow filter", exact: true }),
  ).toBeVisible();
  await expect(
    header.getByRole("button", {
      name: "Remove Happening now filter",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    header.getByRole("button", { name: "Remove Study filter", exact: true }),
  ).toHaveCount(0);
  expect(await camera(page)).toBe(before);
  await page.getByTestId("map-surprise").click();
  await expect(page.getByTestId("map-surprise-message")).toContainText(
    "Nothing to surprise you with yet",
  );
  expect(await camera(page)).toBe(before);
});

test("private lists and advanced Friends controls share one relationship scope", async ({
  page,
}) => {
  await enter(page);
  const header = page.getByTestId("map-exploration-header");
  await header
    .getByRole("button", { name: "Choose Friends filter", exact: true })
    .click();
  const menu = page.getByTestId("map-friends-popover");
  await expect(
    menu.getByRole("radio", { name: "All Friends", exact: true }),
  ).toBeVisible();
  await expect(
    menu.getByRole("radio", { name: "Starred Friends", exact: true }),
  ).toBeVisible();
  const realList = menu.getByRole("radio").nth(2);
  const name = (await realList.innerText()).trim();
  await realList.click();
  await expect(
    header.getByRole("button", { name: `Remove ${name} filter`, exact: true }),
  ).toBeVisible();
  const categories = await interests(page);
  await categories
    .getByRole("checkbox", { name: "Study", exact: true })
    .click();
  await categories
    .getByRole("button", { name: "Close interests", exact: true })
    .click();
  await header.getByRole("button", { name: /^Friends,/ }).click();
  await expect(
    header.getByRole("button", { name: `Remove ${name} filter`, exact: true }),
  ).toHaveCount(0);
  await header.getByRole("button", { name: "Friends", exact: true }).click();
  await expect(
    header.getByRole("button", { name: `Remove ${name} filter`, exact: true }),
  ).toBeVisible();
  await header.getByRole("button", { name: "All", exact: true }).click();
  await header.getByRole("button", { name: "Friends", exact: true }).click();
  await expect(
    header.getByRole("button", { name: `Remove ${name} filter`, exact: true }),
  ).toBeVisible();
  await page.getByTestId("map-filter-toggle").click();
  const advanced = page.getByTestId("advanced-map-filters");
  await advanced
    .getByRole("button", { name: "More filters", exact: true })
    .click();
  await expect(
    advanced.getByRole("button", { name, exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page
    .getByRole("button", { name: "Reset filters", exact: true })
    .click();
  await page.getByRole("button", { name: /^Show \d+ Beacons$/ }).click();
  await expect(
    page.getByRole("dialog", { name: "Filters", exact: true }),
  ).toHaveCount(0);
  await expect(
    header.getByRole("button", { name: /^Remove .* filter$/ }),
  ).toHaveCount(0);
});

test("Surprise Me focuses a real selection, cycles across its starting area and restores the view", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await enter(page, 430);
  const before = await camera(page),
    dice = page.getByTestId("map-surprise");
  await expect(dice).toHaveAttribute("title", "Surprise Me");
  await dice.click();
  const actions = page.getByTestId("map-surprise-actions");
  await expect(actions).toBeVisible({ timeout: 12000 });
  await expect(dice).toBeEnabled();
  const first = await actions.getAttribute("id");
  await expect.poll(() => camera(page)).not.toBe(before);
  await actions
    .getByRole("button", { name: "Try Another", exact: true })
    .click();
  await expect(actions).toBeVisible();
  await expect(actions).not.toHaveAttribute("id", first!);
  await actions
    .getByRole("button", { name: "Back to Previous View", exact: true })
    .click();
  await expect(actions).toHaveCount(0);
  await expect.poll(() => camera(page)).toBe(before);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: test.info().outputPath("surprise-restored.png"),
  });
});

test("manual gestures cancel Surprise restoration and reduced motion still opens the preview", async ({
  page,
}) => {
  await enter(page, 390, true, true);
  await page.getByTestId("map-surprise").click();
  const actions = page.getByTestId("map-surprise-actions");
  await expect(actions).toBeVisible({ timeout: 12000 });
  await page.mouse.move(6, 500);
  await page.mouse.down();
  await page.mouse.move(6, 430, { steps: 10 });
  await page.mouse.up();
  await expect(actions).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Back to Previous View", exact: true }),
  ).toHaveCount(0);
});

test("filters retain an excluded readable selection without moving the camera", async ({
  page,
}) => {
  await enter(page, 430);
  await page.getByTestId("map-surprise").click();
  await expect(page.getByTestId("map-surprise-actions")).toBeVisible();
  const before = await camera(page);
  await page.getByTestId("map-now").click();
  await page.getByTestId("map-filter-toggle").click();
  await page
    .getByTestId("advanced-map-filters")
    .getByRole("radio", { name: "Tomorrow", exact: true })
    .click();
  await page.getByRole("button", { name: /^Show \d+ Beacons$/ }).click();
  await expect(
    page.getByRole("dialog", { name: "Filters", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Selected Beacon is outside the current filters.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByTestId("map-surprise-actions")).toHaveCount(0);
  expect(await camera(page)).toBe(before);
  await page
    .getByRole("button", { name: "Close map preview", exact: true })
    .click();
  const empty = page.getByTestId("map-result-status");
  await expect(empty).toContainText("No Beacons match these filters");
  await empty
    .getByRole("button", {
      name: "Clear Friends and category filters",
      exact: true,
    })
    .click();
  await expect(page.getByTestId("map-now")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await empty
    .getByRole("button", { name: "Remove Happening now", exact: true })
    .click();
  await expect(page.getByTestId("map-now")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  expect(await camera(page)).toBe(before);
});

test("missing profile interests retain ordinary category browsing", async ({
  page,
}) => {
  const account = await mockOnboardingAccount(page, { eligible: false });
  account.snapshot.profiles.find(
    (p) => p.id === account.snapshot.viewer_id,
  )!.interests = [];
  await page.goto("/");
  await expect(page.getByTestId("map-exploration-header")).toBeVisible();
  const menu = await interests(page);
  await expect(
    menu.getByRole("checkbox", { name: "For Me", exact: true }),
  ).toBeDisabled();
  await expect(menu).toContainText("Add profile interests");
  await menu.getByRole("checkbox", { name: "Study", exact: true }).click();
  await expect(
    menu.getByRole("checkbox", { name: "Study", exact: true }),
  ).toBeChecked();
});

test("Plan Focus keeps its stops while Now changes and explains why Surprise is disabled", async ({
  page,
}) => {
  const account = await mockOnboardingAccount(page, { eligible: false });
  const viewer = account.snapshot.viewer_id!;
  account.snapshot.capabilities = {
    ...account.snapshot.capabilities,
    living_plans: false,
  };
  account.snapshot.plans.push({
    id: "quick-filter-plan",
    owner_id: viewer,
    squad_id: null,
    title: "Test itinerary",
    description: "",
    timezone: "America/Chicago",
    start_date: "2026-11-03",
    status: "scheduled",
    created_at: new Date().toISOString(),
  });
  const base = makeDemo().activities[0];
  for (const [index, id] of ["future-one", "future-two"].entries()) {
    account.snapshot.activities.push({
      ...base,
      id,
      title: `Future stop ${index + 1}`,
      owner_id: viewer,
      audience: "private",
      audience_id: null,
      plan_id: "quick-filter-plan",
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
  await page.goto("/?mapPlan=quick-filter-plan");
  const focus = page.getByTestId("map-plan-focus");
  await expect(focus).toContainText("2 visible physical stops");
  await expect(focus).toContainText("Plan Focus shows all stops");
  await expect(focus).toContainText("Exit Plan Focus to use Surprise Me");
  await expect(page.getByTestId("map-surprise")).toBeDisabled();
  await page
    .getByRole("button", { name: "Happening now", exact: true })
    .click();
  await expect(focus).toContainText("2 visible physical stops");
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(page.getByTestId("map-now")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(focus).toContainText("2 visible physical stops");
});

for (const width of [320, 375, 390, 430, 1280])
  test(`fixed discovery controls fit at ${width}px`, async ({ page }) => {
    await enter(page, width, width === 375 || width === 1280, width === 320);
    const header = page.getByTestId("map-exploration-header");
    const controls = [
      page.getByTestId("map-surprise"),
      page.getByTestId("map-now"),
      page.getByTestId("map-filter-toggle"),
    ];
    let right = 0;
    for (const control of controls) {
      const box = (await control.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(right);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      right = box.x + box.width;
    }
    const menu = await interests(page);
    await expect(menu).toBeVisible();
    const box = (await menu.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    await menu.getByRole("checkbox", { name: "Study", exact: true }).click();
    await page
      .getByTestId("map-discovery-menu-backdrop")
      .click({ position: { x: 4, y: 600 } });
    await expect(menu).toHaveCount(0);
    await expect(
      header.getByRole("button", { name: /^Interests, 1 categories/ }),
    ).toBeVisible();
    await page.screenshot({
      path: test.info().outputPath(`discovery-${width}.png`),
    });
  });
