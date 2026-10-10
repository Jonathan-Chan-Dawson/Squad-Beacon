import { expect, test, type Locator } from "@playwright/test";

async function expectInViewport(
  locator: Locator,
  width: number,
  height: number,
) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(height + 1);
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
  const directions = page.getByRole("button", {
    name: "Directions",
    exact: true,
  });
  await expect(directions).toBeVisible();
  await expectInViewport(directions, 320, 568);
  const menuBox = await directions.locator("..").boundingBox();
  expect(menuBox!.x).toBeGreaterThanOrEqual(16);
  expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(304);
  expect(menuBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height);
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
