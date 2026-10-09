import { expect, test, type Page } from "@playwright/test";

async function demo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
}

test("advanced map filters keep multi-category selection and reset cleanly", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await demo(page);

  const header = page.getByTestId("map-exploration-header");
  await expect(header).toBeVisible();
  await expect(
    header.getByRole("textbox", {
      name: "Search Beacons, People, and places",
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "All", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  await page.getByRole("button", { name: "Now", exact: true }).click();
  await expect(page.getByRole("button", { name: "Now", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.getByRole("button", { name: "All", exact: true }).click();

  await page.getByRole("button", { name: "Filters", exact: true }).click();
  const filters = page.getByRole("dialog");
  await expect(filters).toBeVisible();
  await expect(filters.getByTestId("advanced-map-filters")).toBeVisible();
  for (const section of ["When", "Category", "Join"])
    await expect(filters.getByText(section.toUpperCase(), { exact: true })).toBeVisible();

  await filters.getByRole("button", { name: "Study", exact: true }).click();
  await filters.getByRole("button", { name: "Gaming", exact: true }).click();
  await expect(filters.getByRole("button", { name: "Study", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(filters.getByRole("button", { name: "Gaming", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const showResults = filters.getByRole("button", { name: /^Show \d+ Beacons$/ });
  await expect(showResults).toBeInViewport();
  await showResults.click();
  await expect(filters).toHaveCount(0);

  await expect(
    page.getByRole("button", { name: "Remove Study filter", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Remove Gaming filter", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Filters, 2 active", exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Filters, 2 active", exact: true }).click();
  const reopened = page.getByRole("dialog");
  const reset = reopened.getByRole("button", { name: "Reset filters", exact: true });
  await expect(reset).toContainText("2");
  await reset.click();
  await expect(filters.getByRole("button", { name: "Study", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(filters.getByRole("button", { name: "Gaming", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(reset).not.toContainText("2");
  await reopened.getByRole("button", { name: /^Show \d+ Beacons$/ }).click();
  await expect(reopened).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Remove Study filter", exact: true })).toHaveCount(
    0,
  );
  await page.screenshot({ path: "test-results/map-redesign-filters-390.png" });
});

test("Compass opens without requesting location, and selecting a result opens its preview and detail", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as Window & { __mapGeoCalls?: number }).__mapGeoCalls = 0;
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: () => {
          (window as Window & { __mapGeoCalls?: number }).__mapGeoCalls! += 1;
        },
        watchPosition: () => {
          (window as Window & { __mapGeoCalls?: number }).__mapGeoCalls! += 1;
          return 1;
        },
        clearWatch: () => undefined,
      },
    });
  });
  await demo(page);

  await page.getByRole("button", { name: "Compass", exact: true }).click();
  const compass = page.getByRole("dialog");
  await expect(compass).toBeVisible();
  await expect(compass.getByText("Centering the map never shares your location.")).toBeVisible();
  for (const action of [
    "Use my location",
    "Return to overview",
    "Explore everywhere",
    "Search another place",
  ])
    await expect(compass.getByRole("button", { name: action, exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as Window & { __mapGeoCalls?: number }).__mapGeoCalls,
    ),
  ).toBe(0);
  await compass.getByRole("button", { name: "Done", exact: true }).click();
  await expect(compass).toHaveCount(0);

  const search = page.getByRole("textbox", {
    name: "Search Beacons, People, and places",
  });
  await search.fill("Coffee & a little focus");
  const match = page.getByRole("button", {
    name: "Open Coffee & a little focus Beacon",
    exact: true,
  });
  await expect(match).toBeVisible();
  await match.click();
  const preview = page.getByTestId("map-tooltip").getByTestId("map-tooltip-card").first();
  await expect(preview).toBeVisible();
  await page.getByRole("button", { name: "Open Beacon list", exact: true }).click();
  const selectedRow = page.getByRole("button", {
    name: "Select Coffee & a little focus Beacon",
    exact: true,
  });
  await expect(selectedRow).toBeVisible();
  const rowStyles = await page
    .locator('[role="button"][aria-label^="Select "][aria-label$=" Beacon"]')
    .evaluateAll((rows) =>
      rows.map((row) => ({
        label: row.getAttribute("aria-label"),
        borderColor: getComputedStyle(
          row.parentElement?.parentElement ?? row,
        ).borderColor,
      })),
    );
  const selectedStyle = rowStyles.find(
    (row) => row.label === "Select Coffee & a little focus Beacon",
  );
  const unselectedStyle = rowStyles.find(
    (row) => row.label !== "Select Coffee & a little focus Beacon",
  );
  expect(selectedStyle, "the selected Beacon row should be rendered").toBeDefined();
  expect(unselectedStyle, "another visible row should provide an unselected comparison").toBeDefined();
  expect(selectedStyle!.borderColor).not.toBe(unselectedStyle!.borderColor);
  await page.getByRole("button", { name: "Return to map", exact: true }).click();
  await expect(preview).toContainText("Coffee & a little focus");
  await expect(preview).toContainText("going");
  await page.screenshot({ path: "test-results/map-redesign-preview-390.png" });

  await page.getByRole("button", { name: "Open Beacon list", exact: true }).click();
  const row = page.getByRole("button", {
    name: "Select Coffee & a little focus Beacon",
    exact: true,
  });
  await row.click();
  await page.getByRole("button", { name: "Return to map", exact: true }).click();
  await expect(page.getByTestId("map-tooltip-card").first()).toContainText(
    "Coffee & a little focus",
  );
  await page.getByRole("button", { name: "Open Beacon list", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Open Coffee & a little focus Beacon details",
      exact: true,
    })
    .first()
    .click();
  await expect(page).toHaveURL(/\/activity\/[^/]+(?:\?.*)?$/);
});

test("map controls and persistent results stay inside four phone viewports", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const phones = [
    { width: 390, height: 844 },
    { width: 375, height: 667 },
    { width: 360, height: 780 },
    { width: 430, height: 932 },
  ];
  for (const phone of phones) {
    await page.setViewportSize(phone);
    await demo(page);
    await expect(page.getByTestId("map-exploration-header")).toBeVisible();
    const header = await page.getByTestId("map-exploration-header").boundingBox();
    expect(header).not.toBeNull();

    const controls = [];
    for (const label of ["Layers", "Locate", "Fit results"]) {
      const control = page.getByRole("button", { name: label, exact: true });
      await expect(control).toBeInViewport();
      const bounds = await control.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
      expect(bounds!.y).toBeGreaterThanOrEqual(header!.y + header!.height);
      controls.push(bounds!);
    }
    expect(controls[0].y + controls[0].height).toBeLessThanOrEqual(controls[1].y);
    expect(controls[1].y + controls[1].height).toBeLessThanOrEqual(controls[2].y);

    await page.getByRole("button", { name: "Open Beacon list", exact: true }).click();
    await expect(page.getByRole("button", { name: "Return to map", exact: true })).toBeVisible();
    expect(
      await page.evaluate(
        () => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: `test-results/map-redesign-${phone.width}x${phone.height}.png` });
  }
});

test("panning offers an actionable Search this area control", async ({ page }) => {
  test.setTimeout(15_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await demo(page);
  const search = page.getByRole("textbox", {
    name: "Search Beacons, People, and places",
  });
  await search.fill("game room");
  await page.getByRole("button", { name: /^Explore The game room$/i }).first().click();
  await expect(page.locator(".leaflet-container")).toBeVisible();

  await page.mouse.move(210, 430);
  await page.mouse.wheel(0, 600);
  await page.mouse.move(210, 430);
  await page.mouse.down();
  await page.mouse.move(80, 510, { steps: 12 });
  await page.mouse.up();

  const searchArea = page.getByRole("button", {
    name: "Search this area",
    exact: true,
  });
  await expect(searchArea).toBeVisible();
  await expect(searchArea).toBeEnabled();
  const header = await page.getByTestId("map-exploration-header").boundingBox();
  const button = await searchArea.boundingBox();
  expect(button).not.toBeNull();
  expect(button!.y).toBeLessThan(844 * 0.4);
  expect(button!.y).toBeGreaterThan(header!.y);
  const hitTest = await page.evaluate(({ x, y }) => {
    const describe = (element: Element | null) => {
      if (!element) return null;
      const bounds = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        tag: element.tagName,
        testID: element.getAttribute("data-testid"),
        role: element.getAttribute("role"),
        label: element.getAttribute("aria-label"),
        className: typeof element.className === "string" ? element.className : "",
        rect: {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
        },
        position: style.position,
        zIndex: style.zIndex,
        pointerEvents: style.pointerEvents,
        transform: style.transform,
        overflow: style.overflow,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        opacity: style.opacity,
      };
    };
    const stack: Array<Record<string, unknown>> = [];
    let element = document.elementFromPoint(x, y);
    while (element && stack.length < 8) {
      stack.push(describe(element)!);
      element = element.parentElement;
    }
    const area = document.querySelector('[aria-label="Search this area"]');
    const header = document.querySelector('[data-testid="map-exploration-header"]');
    return {
      pointStack: stack,
      areaAncestors: [area, area?.parentElement, area?.parentElement?.parentElement, area?.parentElement?.parentElement?.parentElement, area?.parentElement?.parentElement?.parentElement?.parentElement].map(describe),
      headerWrapper: describe(header?.parentElement ?? null),
      fullMapScreen: describe(document.querySelector('[data-testid="full-map-screen"]')),
      mapRoot: describe(document.querySelector('[aria-label="Beacon map"]')),
    };
  }, { x: button!.x + button!.width / 2, y: button!.y + button!.height / 2 });
  expect(
    hitTest.pointStack.some((element) => element.label === "Search this area"),
    `the search action should receive center-point pointer hits: ${JSON.stringify({ button, hitTest })}`,
  ).toBe(true);
  await searchArea.click();
  await expect(page.getByRole("button", { name: "Search this area", exact: true })).toHaveCount(
    0,
  );
});
