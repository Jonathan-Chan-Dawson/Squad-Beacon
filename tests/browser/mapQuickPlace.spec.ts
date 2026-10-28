import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.routeWebSocket("**/hot", () => {});
  await page.routeWebSocket("**/message", () => {});
});

for (const width of [320, 375, 430])
  for (const appearance of ["light", "dark"]) {
    test(`Natural Place stays still, pans, searches, cancels and opens creation at ${width}px ${appearance}`, async ({
      page,
    }) => {
      test.setTimeout(120000);
      await page.setViewportSize({ width, height: 844 });
      await page.addInitScript((appearance) => {
        localStorage.setItem(
          "beacon.map-device.v2",
          JSON.stringify({ hintsSeen: 3 }),
        );
        localStorage.setItem("beacon.appearance", appearance);
      }, appearance);
      await page.goto("/");
      const demo = page.getByRole("button", { name: /Explore the demo/ });
      await expect
        .poll(
          () =>
            demo.evaluate((element) =>
              Object.keys(element).some((key) =>
                key.startsWith("__reactProps$"),
              ),
            ),
          { timeout: 90000 },
        )
        .toBe(true);
      await demo.click();
      await expect(page.locator(".leaflet-container")).toBeVisible();
      const place = page.getByRole("button", {
        name: "Place: choose a location to create",
        exact: true,
      });
      await expect(place).toBeVisible();
      const box = await place.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      await place.click();
      await expect(page.getByTestId("map-place-instructions")).toBeVisible();
      const map = page.locator(".leaflet-container");
      const camera = () =>
        page.locator(".leaflet-map-pane").getAttribute("style");
      const markerLayout = () =>
        page
          .locator(
            '.leaflet-marker-icon:not(:has([data-testid="map-temporary-pin"]))',
          )
          .evaluateAll((nodes) =>
            nodes.map((node) => node.getAttribute("style")),
          );
      // Neither panning nor zooming is a location edit. Only an explicit tap/drag is.
      const initialCamera = await camera();
      const initialMarkers = await markerLayout();
      await map.click({ position: { x: width / 2, y: 330 }, force: true });
      const panel = page.getByTestId("map-place-confirmation");
      await expect(panel).toBeVisible();
      await expect.poll(camera).toBe(initialCamera);
      await expect.poll(markerLayout).toEqual(initialMarkers);
      await expect(
        page.getByRole("button", { name: "Use This Location", exact: true }),
      ).toHaveCount(0);
      await expect(
        panel.getByRole("button", { name: "Create Beacon", exact: true }),
      ).toBeVisible();
      await expect(
        panel.getByRole("button", { name: "Create Ping", exact: true }),
      ).toBeVisible();
      const pin = page.getByTestId("map-temporary-pin");
      const coordinate = () =>
        pin.evaluate((node) => [
          node.getAttribute("data-latitude"),
          node.getAttribute("data-longitude"),
        ]);
      const firstPoint = await coordinate();
      const mapBox = (await map.boundingBox())!;
      const pinBox = (await pin.boundingBox())!;
      expect(
        Math.abs(pinBox.x + pinBox.width / 2 - mapBox.x - width / 2),
      ).toBeLessThan(2);
      expect(Math.abs(pinBox.y + pinBox.height - mapBox.y - 330)).toBeLessThan(
        2,
      );
      const panelBox = (await panel.boundingBox())!;
      expect(panelBox.x).toBeGreaterThanOrEqual(0);
      expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(width);
      expect(panelBox.width).toBeLessThanOrEqual(260);
      expect(panelBox.height).toBeLessThan(120);
      expect(panelBox.y).toBeGreaterThanOrEqual(0);
      expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(844);
      expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(pinBox.y);
      await expect(
        panel.getByRole("button", {
          name: "Cancel location placement",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        panel.getByRole("button", { name: "Cancel", exact: true }),
      ).toHaveCount(0);
      await map.click({ position: { x: width - 25, y: 560 }, force: true });
      await expect.poll(coordinate).not.toEqual(firstPoint);
      await expect.poll(camera).toBe(initialCamera);
      await expect
        .poll(async () => {
          const box = await panel.boundingBox();
          return (
            !!box &&
            box.x >= 0 &&
            box.x + box.width <= width &&
            box.y >= 0 &&
            box.y + box.height <= 844
          );
        })
        .toBe(true);
      const repeatedPoint = await coordinate();
      await page.mouse.move(35, 80);
      await page.mouse.down();
      await page.mouse.move(100, 125, { steps: 12 });
      await page.mouse.up();
      await expect.poll(camera).not.toBe(initialCamera);
      await expect.poll(coordinate).toEqual(repeatedPoint);
      const beforeZoom = (await pin.boundingBox())!;
      await page.mouse.move(35, 80);
      await page.mouse.wheel(0, -400);
      await expect
        .poll(async () => (await pin.boundingBox())?.y)
        .not.toBe(beforeZoom.y);
      await expect(map).not.toHaveClass(/leaflet-zoom-anim/);
      await expect.poll(coordinate).toEqual(repeatedPoint);
      await expect(panel).toBeVisible();
      await map.click({ position: { x: 130, y: 250 }, force: true });
      await expect.poll(coordinate).not.toEqual(repeatedPoint);
      const beforeDrag = await coordinate();
      const dragCamera = await camera();
      const dragPin = (await pin.boundingBox())!;
      expect(
        await page.evaluate(
          ({ x, y }) =>
            document
              .elementFromPoint(x, y)
              ?.closest(".leaflet-marker-draggable") !== null,
          { x: dragPin.x + dragPin.width / 2, y: dragPin.y + 14 },
        ),
      ).toBe(true);
      await page.mouse.move(dragPin.x + dragPin.width / 2, dragPin.y + 14);
      await page.mouse.down();
      await page.mouse.move(dragPin.x + 55, dragPin.y + 55, { steps: 12 });
      await page.mouse.up();
      await expect.poll(coordinate).not.toEqual(beforeDrag);
      await expect.poll(camera).toBe(dragCamera);
      await page
        .getByRole("button", { name: "Search for a location", exact: true })
        .click();
      await page.getByLabel("Search location", { exact: true }).fill("Chicago");
      await page
        .getByRole("button", { name: "Search worldwide places", exact: true })
        .click();
      await expect(page.getByText(/Demo city examples/)).toBeVisible();
      await page
        .getByRole("button", { name: /^Explore Chicago$/ })
        .first()
        .click();
      await expect(panel).toContainText("Chicago");
      const chosenDestination = await coordinate();
      await expect.poll(coordinate).not.toEqual(beforeDrag);
      await page.mouse.move(width / 2, 330);
      await page.mouse.down();
      await page.mouse.move(width / 2 + 60, 370, { steps: 12 });
      await page.mouse.up();
      await expect(panel).toContainText("Chicago");
      await expect.poll(coordinate).toEqual(chosenDestination);
      if (width === 375)
        await page.screenshot({ path: `.expo/compact-pin-${appearance}.png` });
      await panel
        .getByRole("button", { name: "Create Beacon", exact: true })
        .click();
      await expect(
        page.getByRole("button", {
          name: "+ Create Blank Beacon",
          exact: true,
        }),
      ).toBeVisible();
      expect(new URL(page.url()).searchParams.get("latitude")).toBe(
        chosenDestination[0],
      );
      expect(new URL(page.url()).searchParams.get("longitude")).toBe(
        chosenDestination[1],
      );
      await page.goBack();
      await expect(place).toBeVisible();
      await place.click();
      await map.click({ position: { x: 35, y: 350 }, force: true });
      await expect(panel).toBeVisible();
      const beforeCancel = await camera();
      await panel
        .getByRole("button", { name: "Cancel location placement", exact: true })
        .click();
      await expect.poll(camera).toBe(beforeCancel);
      await expect(panel).toHaveCount(0);
      await place.click();
      await page.keyboard.press("Escape");
      await expect.poll(camera).toBe(beforeCancel);
      await expect(panel).toHaveCount(0);
      await expect(place).toBeVisible();
      await place.click();
      await page
        .locator(".leaflet-container")
        .click({ position: { x: width / 2, y: 330 }, force: true });
      await panel
        .getByRole("button", { name: "Create Ping", exact: true })
        .click();
      await expect(page).toHaveURL(/planning\/create/);
      expect(new URL(page.url()).searchParams.get("kind")).toBe("ping");
      expect(new URL(page.url()).searchParams.get("latitude")).toBeTruthy();
    });
  }

test("returning from the Map updates only the existing draft location, including Cancel", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.addInitScript(() =>
    localStorage.setItem(
      "beacon.map-device.v2",
      JSON.stringify({ hintsSeen: 3 }),
    ),
  );
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page
    .getByRole("button", { name: "+ Create Blank Beacon", exact: true })
    .click();
  const title = page.getByLabel("Activity title", { exact: true });
  await title.fill("Keep this draft intact");
  await page
    .getByRole("button", { name: "Choose location on Map", exact: true })
    .click();
  await page
    .locator(".leaflet-container")
    .last()
    .click({ position: { x: 190, y: 380 }, force: true });
  const tooltip = page.getByTestId("map-place-confirmation");
  await expect(
    tooltip.getByRole("button", { name: "Use This Location", exact: true }),
  ).toBeVisible();
  await expect(
    tooltip.getByRole("button", { name: "Create Beacon", exact: true }),
  ).toHaveCount(0);
  await tooltip
    .getByRole("button", { name: "Use This Location", exact: true })
    .click();
  await expect(title).toHaveValue("Keep this draft intact");
  await page
    .getByRole("button", { name: "Adjust on Map", exact: true })
    .click();
  await expect(tooltip).toBeVisible();
  const pin = page.getByTestId("map-temporary-pin");
  const oldPoint = await pin.getAttribute("data-latitude");
  await page
    .locator(".leaflet-container")
    .last()
    .click({ position: { x: 30, y: 540 }, force: true });
  await expect(pin).not.toHaveAttribute("data-latitude", oldPoint!);
  await tooltip
    .getByRole("button", { name: "Cancel location placement", exact: true })
    .click();
  await expect(title).toHaveValue("Keep this draft intact");
  await page
    .getByRole("button", { name: "Adjust on Map", exact: true })
    .click();
  await expect(pin).toHaveAttribute("data-latitude", oldPoint!);
});

test("pin tooltip stays on screen and clear of the pin on a short phone", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() =>
    localStorage.setItem(
      "beacon.map-device.v2",
      JSON.stringify({ hintsSeen: 3 }),
    ),
  );
  await page.goto("/");
  const demo = page.getByRole("button", { name: /Explore the demo/ });
  await expect
    .poll(
      () =>
        demo.evaluate((element) =>
          Object.keys(element).some((key) => key.startsWith("__reactProps$")),
        ),
      { timeout: 90000 },
    )
    .toBe(true);
  await demo.click();
  await page
    .getByRole("button", {
      name: "Place: choose a location to create",
      exact: true,
    })
    .click();
  const map = page.locator(".leaflet-container");
  const tooltip = page.getByTestId("map-place-confirmation");
  const pin = page.getByTestId("map-temporary-pin");
  let latitude: string | null = null;
  for (const point of [
    { x: 20, y: 130 },
    { x: 300, y: 390 },
    { x: 300, y: 130 },
    { x: 20, y: 390 },
  ]) {
    await map.click({ position: point, force: true });
    await expect(pin).not.toHaveAttribute(
      "data-latitude",
      latitude ?? "missing",
    );
    latitude = await pin.getAttribute("data-latitude");
    await expect(tooltip).toBeVisible();
    await expect
      .poll(async () => {
        const box = await tooltip.boundingBox(),
          marker = await pin.boundingBox();
        return (
          !!box &&
          !!marker &&
          box.x >= 0 &&
          box.x + box.width <= 320 &&
          box.y >= 0 &&
          box.y + box.height <= 568 &&
          (box.y + box.height <= marker.y || box.y >= marker.y + marker.height)
        );
      })
      .toBe(true);
  }
  await page.screenshot({ path: ".expo/compact-pin-short.png" });
});
