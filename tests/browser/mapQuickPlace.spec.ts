import { expect, test } from "@playwright/test";

for (const width of [320, 375, 430])
  for (const appearance of ["light", "dark"]) {
    test(`Quick Place confirms, searches, cancels and opens creation at ${width}px ${appearance}`, async ({
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
      const panel = page.getByTestId("map-place-confirmation");
      await expect(panel).toBeVisible();
      const panelBox = await panel.boundingBox();
      expect(panelBox!.x).toBeGreaterThanOrEqual(0);
      expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(width);
      expect(panelBox!.height).toBeLessThan(250);
      await expect(
        page.getByRole("button", { name: "Use This Location", exact: true }),
      ).toBeDisabled();
      await page
        .locator(".leaflet-container")
        .click({ position: { x: width / 2, y: 330 }, force: true });
      await expect(
        page.getByRole("button", { name: "Use This Location", exact: true }),
      ).toBeEnabled();
      await page
        .getByRole("button", { name: "Use This Location", exact: true })
        .click();
      await expect(
        panel.getByRole("button", { name: "Create Beacon", exact: true }),
      ).toBeVisible();
      await expect(
        panel.getByRole("button", { name: "Create Ping", exact: true }),
      ).toBeVisible();
      await panel
        .getByRole("button", { name: "Change location", exact: true })
        .click();
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
      await page.mouse.move(width / 2, 330);
      await page.mouse.down();
      await page.mouse.move(width / 2 + 60, 370, { steps: 12 });
      await page.mouse.up();
      await expect(panel).toContainText("Pinned location");
      if (width === 375)
        await page.screenshot({ path: `.expo/place-${appearance}.png` });
      await page
        .getByRole("button", { name: "Use This Location", exact: true })
        .click();
      await panel
        .getByRole("button", { name: "Create Beacon", exact: true })
        .click();
      await expect(
        page.getByRole("button", {
          name: "+ Create Blank Beacon",
          exact: true,
        }),
      ).toBeVisible();
      expect(new URL(page.url()).searchParams.get("latitude")).toBeTruthy();
      await page.goBack();
      await expect(place).toBeVisible();
      await place.click();
      await page.keyboard.press("Escape");
      await expect(panel).toHaveCount(0);
      await expect(place).toBeVisible();
      await place.click();
      await page
        .locator(".leaflet-container")
        .click({ position: { x: width / 2, y: 330 }, force: true });
      await page
        .getByRole("button", { name: "Use This Location", exact: true })
        .click();
      await panel
        .getByRole("button", { name: "Create Ping", exact: true })
        .click();
      await expect(page).toHaveURL(/planning\/create/);
      expect(new URL(page.url()).searchParams.get("kind")).toBe("ping");
      expect(new URL(page.url()).searchParams.get("latitude")).toBeTruthy();
    });
  }
