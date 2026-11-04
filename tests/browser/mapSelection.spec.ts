import { expect, test, type Page, type Locator } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.routeWebSocket("**/hot", () => {});
  await page.routeWebSocket("**/message", () => {});
});

async function enter(page: Page, dark: boolean) {
  await page.addInitScript((dark) => {
    const small = innerWidth <= 320;
    localStorage.setItem(
      "beacon.map-device.v2",
      JSON.stringify({
        hintsSeen: 3,
        camera: {
          center: {
            latitude: small ? 41.8835 : 41.883,
            longitude: small ? -87.6357 : -87.636,
          },
          zoom: small ? 16.5 : 17,
          bounds: {
            north: small ? 41.8885 : 41.888,
            south: small ? 41.8785 : 41.878,
            east: small ? -87.6307 : -87.631,
            west: small ? -87.6407 : -87.641,
          },
        },
      }),
    );
    localStorage.setItem("beacon.appearance", dark ? "dark" : "light");
  }, dark);
  await page.goto("/");
  const demo = page.getByRole("button", { name: /Explore the demo/ });
  await expect
    .poll(
      () =>
        demo.evaluate((node) =>
          Object.keys(node).some((key) => key.startsWith("__reactProps$")),
        ),
      { timeout: 90000 },
    )
    .toBe(true);
  await demo.click();
  await expect(page.locator(".leaflet-container")).toBeVisible();
  let previous = "",
    stable = 0;
  await expect
    .poll(
      async () => {
        const next = await camera(page);
        stable = next === previous ? stable + 1 : 0;
        previous = next;
        return stable;
      },
      { intervals: [200], timeout: 15000 },
    )
    .toBeGreaterThanOrEqual(3);
}

async function camera(page: Page) {
  return page
    .locator(".leaflet-container")
    .evaluate((node) =>
      JSON.stringify([
        node.querySelector(".leaflet-map-pane")?.getAttribute("style"),
        node.querySelector(".leaflet-proxy")?.getAttribute("style"),
      ]),
    );
}

// Observe the whole former animation interval, so an immediate equality cannot
// accidentally pass just before a selection-triggered flyTo begins.
async function stayedStill(page: Page, before: string) {
  const snapshots = await page
    .locator(".leaflet-container")
    .evaluate(async (node) => {
      const samples: string[] = [],
        started = performance.now();
      do {
        samples.push(
          JSON.stringify([
            node.querySelector(".leaflet-map-pane")?.getAttribute("style"),
            node.querySelector(".leaflet-proxy")?.getAttribute("style"),
          ]),
        );
        await new Promise(requestAnimationFrame);
      } while (performance.now() - started < 700);
      return [...new Set(samples)];
    });
  expect(snapshots).toEqual([before]);
}

async function exposedMarker(page: Page, locator: Locator) {
  const label = await locator.evaluateAll((nodes) => {
    const node = nodes.find((node) => {
      const box = node.getBoundingClientRect();
      const x = box.x + box.width / 2,
        y = box.y + box.height / 2;
      if (x < 12 || x > innerWidth - 12 || y < 160 || y > innerHeight - 75)
        return false;
      const target = document.elementFromPoint(
        box.x + box.width / 2,
        box.y + box.height / 2,
      );
      return !!target && node.contains(target);
    });
    return node?.getAttribute("aria-label");
  });
  if (!label)
    throw new Error(
      "Demo has no exposed marker: " +
        JSON.stringify(
          await locator.evaluateAll((nodes) =>
            nodes.map((node) => ({
              label: node.getAttribute("aria-label"),
              rect: node.getBoundingClientRect().toJSON(),
            })),
          ),
        ),
    );
  return page.getByRole("button", { name: label, exact: true }).first();
}

async function fits(page: Page, locator: Locator) {
  await expect(locator).toBeVisible();
  await expect
    .poll(async () => {
      const box = await locator.boundingBox(),
        viewport = page.viewportSize()!;
      return (
        !!box &&
        box.x >= 0 &&
        box.y >= 0 &&
        box.x + box.width <= viewport.width &&
        box.y + box.height <= viewport.height
      );
    })
    .toBe(true);
}

async function outside(page: Page) {
  const point = await page.evaluate(() => {
    for (const [x, y] of [
      [innerWidth - 6, 240],
      [6, 300],
      [innerWidth / 2, innerHeight - 140],
    ]) {
      const target = document.elementFromPoint(x, y);
      if (
        target?.closest(".leaflet-container") &&
        !target.closest('button,[role="button"]')
      )
        return { x, y };
    }
    throw new Error("No exposed map dismissal point");
  });
  await page.mouse.click(point.x, point.y);
}

for (const [width, height, dark] of [
  [320, 568, false],
  [375, 844, true],
  [430, 900, false],
  [1280, 900, true],
] as const) {
  test(`one-tap Map previews and camera stability at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height });
    await enter(page, dark);
    let before = await camera(page);
    const avatar = await exposedMarker(
      page,
      page.locator('.leaflet-container button[aria-label^="Map friend:"]'),
    );
    await avatar.click();
    const tooltip = page.getByTestId("map-tooltip");
    await fits(page, tooltip);
    await expect(page.getByTestId("map-person-preview")).toBeVisible();
    await expect(page.locator('[data-expanded="true"]')).toHaveCount(0);
    await stayedStill(page, before);
    await outside(page);
    await expect(tooltip).toHaveCount(0);
    if (width === 320) {
      // Explicit user pan brings the southern Beacon clear of the short-screen controls.
      await page.mouse.move(6, 360);
      await page.mouse.down();
      await page.mouse.move(6, 280, { steps: 12 });
      await page.mouse.up();
      await expect.poll(() => camera(page)).not.toBe(before);
      await page.waitForTimeout(350);
      before = await camera(page);
    }

    const beacon = await exposedMarker(
      page,
      page.locator('.leaflet-container button[aria-label^="Map:"]'),
    );
    await beacon.click();
    await fits(page, tooltip);
    await expect(page.getByTestId("map-tooltip-card")).toBeVisible();
    await stayedStill(page, before);
    const info = tooltip.getByRole("button", {
      name: "Beacon info & actions",
      exact: true,
    });
    const close = tooltip.getByRole("button", {
      name: "Close map preview",
      exact: true,
    });
    const infoBox = (await info.boundingBox())!,
      closeBox = (await close.boundingBox())!;
    expect(infoBox.x + infoBox.width).toBeLessThanOrEqual(closeBox.x + 1);
    expect(Math.abs(infoBox.y - closeBox.y)).toBeLessThan(2);
    await expect(
      tooltip.getByTestId("discovery-card-actions").getByRole("button"),
    ).toHaveCount(1);
    const actionBox = (await tooltip
      .getByTestId("discovery-card-actions")
      .getByRole("button")
      .boundingBox())!;
    const previewBox = (await tooltip.boundingBox())!;
    expect(actionBox.y + actionBox.height).toBeLessThanOrEqual(
      previewBox.y + previewBox.height + 1,
    );
    await expect(
      tooltip.getByRole("button", { name: "See overview", exact: true }),
    ).toHaveCount(0);
    await info.click();
    await expect(
      page.getByRole("button", { name: "Share Beacon", exact: true }),
    ).toBeVisible();
    await stayedStill(page, before);
    await page.keyboard.press("Escape");
    await expect(tooltip).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Share Beacon", exact: true }),
    ).toHaveCount(0);
    await page.screenshot({ path: `.expo/map-selection-${width}.png` });
    await close.click();
    await expect(tooltip).toHaveCount(0);
    await stayedStill(page, before);

    const cluster = await exposedMarker(
      page,
      page.locator('[data-testid="map-constellation"][role="button"]'),
    );
    if (width === 430) {
      await cluster.focus();
      await page.keyboard.press("Enter");
    } else await cluster.click();
    const explorer = page.getByTestId("map-nearby-panel");
    await fits(page, page.getByTestId("map-cluster-callout"));
    await expect(explorer).toBeVisible();
    await stayedStill(page, before);
    if (width === 375) {
      const search = explorer.getByRole("textbox", {
        name: "Search nearby Beacons and friends",
      });
      await search.fill("Coffee");
      const summary = await explorer.innerText();
      await page.mouse.move(6, 350);
      await page.mouse.down();
      await page.mouse.move(6, 326, { steps: 8 });
      await page.mouse.up();
      await expect.poll(() => camera(page)).not.toBe(before);
      await expect.poll(() => explorer.innerText()).toBe(summary);
      await expect(search).toHaveValue("Coffee");
      await page.waitForTimeout(350);
      before = await camera(page);
    }
    const row = explorer
      .getByRole("button", {
        name: /^(Select .+ Beacon|View .+'s profile|Preview .+ public Beacon)$/,
      })
      .first();
    await row.click();
    await expect(explorer).toHaveCount(0);
    await expect(
      tooltip.or(page.getByTestId("map-public-callout")),
    ).toBeVisible();
    await stayedStill(page, before);
    if (width === 375) {
      await page.mouse.move(6, 350);
      await page.mouse.down();
      await page.mouse.move(6, 326, { steps: 8 });
      await page.mouse.up();
      await expect.poll(() => camera(page)).not.toBe(before);
      await expect(
        tooltip.or(page.getByTestId("map-public-callout")),
      ).toBeVisible();
      await page.mouse.wheel(0, -220);
      await page.waitForTimeout(500);
      await expect(
        tooltip.or(page.getByTestId("map-public-callout")),
      ).toBeVisible();
    }
    await page.keyboard.press("Escape");
    await expect(tooltip).toHaveCount(0);
  });
}

test("public selection stays coarse and anchored without changing the area", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page, false);
  const before = await camera(page);
  await page
    .getByRole("textbox", {
      name: "Search places, Beacons, people and communities",
      exact: true,
    })
    .fill("concert");
  await page
    .getByTestId("map-search-results")
    .getByRole("button", {
      name: "Preview Lakefront Summer Lights concert public Beacon",
      exact: true,
    })
    .click();
  const callout = page.getByTestId("map-public-callout");
  await fits(page, callout);
  await expect(callout).toContainText(/approximate area/i);
  await stayedStill(page, before);
  await callout
    .getByRole("button", { name: "Beacon info & actions", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Public Beacon information" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(callout).toBeVisible();
  await callout
    .getByRole("button", { name: "Close map preview", exact: true })
    .click();
  await expect(callout).toHaveCount(0);
  await stayedStill(page, before);
});

test("cluster Info preserves selection and explicit Zoom to Fit still moves the camera", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enter(page, true);
  const before = await camera(page);
  const cluster = await exposedMarker(
    page,
    page.locator('[data-testid="map-constellation"][role="button"]'),
  );
  await cluster.click();
  const explorer = page.getByTestId("map-nearby-panel");
  await expect(explorer).toBeVisible();
  await explorer
    .getByRole("button", { name: "Cluster info & actions", exact: true })
    .click();
  await stayedStill(page, before);
  await page.getByRole("button", { name: "Zoom to fit", exact: true }).click();
  await expect.poll(() => camera(page)).not.toBe(before);
  await expect(explorer).toBeVisible();
});

test("saving a Map Beacon refreshes its Bookmark without moving the camera", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 430, height: 900 });
  await enter(page, false);
  const marker = await exposedMarker(
    page,
    page.locator(
      '.leaflet-container button[aria-label^="Map:"]:not([aria-label*="Your Beacon"])',
    ),
  );
  const initial = await marker.evaluate((node) => (node.getAttribute("aria-label") ?? node.querySelector("button[aria-label]")?.getAttribute("aria-label"))!);
  const base = initial.replace(/, Saved/g, "");
  const stableMarker = page
    .locator('.leaflet-container button[aria-label^="Map:"]')
    .filter({ has: page.locator("[data-cluster-face]") })
    .and(
      page.getByRole("button", {
        name: new RegExp(
          "^" +
            base
              .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
              .replace(/, Friend-hosted|, Live/g, "") +
            "(?:,|$)",
        ),
      }),
    )
    .first();
  const before = await camera(page);
  await marker.click();
  const card = page.getByTestId("map-tooltip-card");
  await expect(card).toBeVisible();
  const unsave = card.getByRole("button", {
    name: "Unsave Beacon",
    exact: true,
  });
  if (await unsave.count()) await unsave.click();
  await expect(stableMarker.getByTestId("beacon-saved-bookmark")).toHaveCount(
    0,
  );
  await card.getByRole("button", { name: "Save Beacon", exact: true }).click();
  await expect(stableMarker.getByTestId("beacon-saved-bookmark")).toHaveCount(
    1,
  );
  await expect(stableMarker).toHaveAttribute("aria-label", /Saved/);
  await stayedStill(page, before);
  await card.getByRole("button", { name: "Close map preview", exact: true }).click();
  await expect(card).toHaveCount(0);
  await expect(stableMarker.getByTestId("beacon-saved-bookmark")).toHaveCount(1);
  await page.screenshot({ path: test.info().outputPath("saved-beacon.png") });
  await stableMarker.click();
  await expect(card).toBeVisible();
  await card
    .getByRole("button", { name: "Unsave Beacon", exact: true })
    .click();
  await expect(stableMarker.getByTestId("beacon-saved-bookmark")).toHaveCount(
    0,
  );
  await stayedStill(page, before);
});
