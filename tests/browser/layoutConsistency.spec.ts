import { expect, test, type Locator } from "@playwright/test";

async function expectInViewport(
  locator: Locator,
  width: number,
  height: number,
) {
  await expect
    .poll(
      async () => {
        const box = await locator.boundingBox();
        if (!box) return Infinity;
        return Math.max(
          -box.x,
          -box.y,
          box.x + box.width - width,
          box.y + box.height - height,
        );
      },
      { message: "the menu must finish opening inside the viewport" },
    )
    .toBeLessThanOrEqual(1);
}

test("Map previews and edge menus stay inside the usable Map area", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page
    .getByRole("textbox", {
      name: "Search places, Beacons, people and communities",
      exact: true,
    })
    .fill("Riverbend Cafe");
  await page
    .getByRole("button", { name: "Explore Riverbend Cafe", exact: true })
    .click();
  const preview = page.getByTestId("map-place-preview-slot");
  const mapBox = await page.getByTestId("full-map-screen").boundingBox();
  const headerBox = await page
    .getByTestId("map-exploration-header")
    .boundingBox();
  const previewBox = await preview.boundingBox();
  expect(previewBox!.x).toBe(16);
  expect(previewBox!.width).toBe(288);
  expect(previewBox!.y).toBeGreaterThanOrEqual(
    headerBox!.y + headerBox!.height,
  );
  expect(previewBox!.y + previewBox!.height).toBeLessThan(
    mapBox!.y + mapBox!.height,
  );
  await preview
    .getByRole("button", { name: "Create Beacon here", exact: true })
    .scrollIntoViewIfNeeded();
  await expectInViewport(
    preview.getByRole("button", { name: "Create Beacon here", exact: true }),
    320,
    568,
  );
  await preview
    .getByRole("button", { name: "Close place preview", exact: true })
    .click();
  await page.mouse.click(310, 350, { button: "right" });
  const menu = page.getByRole("menu", {
    name: "Actions for this map location",
    exact: true,
  });
  await expect(menu).toBeVisible();
  for (const [name, subtitle] of [
    ["Share a Pulse. What's happening here?", "What's happening here?"],
    ["Create a Beacon. Plan an activity here", "Plan an activity here"],
    ["Get Directions. Open in your maps app", "Open in your maps app"],
  ]) {
    const action = menu.getByRole("menuitem", { name, exact: true });
    await expect(action).toBeVisible();
    await expectInViewport(action, 320, 568);
    await expect(action).toContainText(subtitle);
  }
  const menuBox = await menu.boundingBox();
  expect(menuBox!.x).toBeGreaterThanOrEqual(16);
  expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(304);
  expect(menuBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height);
  await menu.getByRole("button", { name: "Close location actions" }).click();
  await expect(menu).not.toBeVisible();
  await page.mouse.click(310, 350, { button: "right" });
  await page
    .getByRole("menuitem", {
      name: "Share a Pulse. What's happening here?",
      exact: true,
    })
    .click();
  await expect(page.getByTestId("add-live-update-sheet")).toBeVisible();
});

test("Map location directions open the selected coordinate in an external map URL", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page
    .getByRole("textbox", {
      name: "Search places, Beacons, people and communities",
      exact: true,
    })
    .fill("Riverbend Cafe");
  await page
    .getByRole("button", { name: "Explore Riverbend Cafe", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Close place preview", exact: true })
    .click();
  await page.context().route("https://www.google.com/maps/dir/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<html><body>Directions test destination</body></html>",
    }),
  );
  const requestPromise = page.context().waitForEvent(
    "request",
    (request) => /google\.com\/maps\/dir\//.test(request.url()),
  );
  await page.mouse.click(310, 350, { button: "right" });
  await page
    .getByRole("menuitem", {
      name: "Get Directions. Open in your maps app",
      exact: true,
    })
    .click();
  const request = await requestPromise;
  const destination = new URL(request.url()).searchParams.get("destination");
  expect(destination).toMatch(/^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/);
});

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 1280, height: 900 },
]) {
  test(`shared menus are centered and fully visible at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.getByRole("button", { name: /Explore the demo/ }).click();
    await page
      .getByRole("button", { name: "Create Beacon", exact: true })
      .click();
    const menu = page.getByRole("dialog", { name: "What are you up to?" });
    const create = menu.getByRole("button", {
      name: "Create a beacon",
      exact: true,
    });
    await expect(create).toBeVisible();
    const createBox = await create.boundingBox();
    expect(createBox!.width).toBeLessThanOrEqual(608);
    await expect
      .poll(async () => {
        const box = await create.boundingBox();
        return box
          ? Math.abs(box.x + box.width / 2 - viewport.width / 2)
          : Infinity;
      })
      .toBeLessThan(1);
    for (const name of [
      "Create a beacon",
      "Share a status",
      "Make a squad plan",
    ]) {
      await expectInViewport(
        menu.getByRole("button", { name, exact: true }),
        viewport.width,
        viewport.height,
      );
    }
    await menu.getByRole("button", { name: "Close", exact: true }).click();
    await expect(menu).not.toBeVisible();

    await page.getByRole("tab", { name: "Profile", exact: true }).click();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Search settings", exact: true })
      .fill("quiet");
    await page
      .getByRole("button", { name: "Quiet hours", exact: true })
      .click();
    const quiet = page.getByRole("dialog", {
      name: "Quiet hours",
      exact: true,
    });
    const save = quiet.getByRole("button", {
      name: "Save quiet hours",
      exact: true,
    });
    await expect(save).toBeVisible();
    await save.scrollIntoViewIfNeeded();
    await expectInViewport(save, viewport.width, viewport.height);
    const start = quiet.getByRole("textbox", {
      name: "Quiet hours start (0–23)",
      exact: true,
    });
    const box = await start.boundingBox();
    expect(Math.abs(box!.x + box!.width / 2 - viewport.width / 2)).toBeLessThan(
      1,
    );
    await page.screenshot({
      path: `test-results/layout/quiet-${viewport.width}.png`,
    });
  });
}
