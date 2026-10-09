import { expect, test, type Page } from "@playwright/test";

async function startDemo(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
}

type SettledMapMarker = {
  identity: string;
  x: number;
  y: number;
  scale: string;
  memberCount: number;
};

async function findStableUnobstructedMarker(
  page: Page,
  selector: string,
  identityAttribute: string,
): Promise<SettledMapMarker> {
  let signature = "";
  let stableSamples = 0;
  let marker: SettledMapMarker | null = null;
  await expect
    .poll(async () => {
      marker = await page.locator(selector).evaluateAll((items, attribute) => {
        // Prefer a smaller reachable group when a broad cluster has split.
        const clusterSize = (element: Element) => {
          const counts = element.getAttribute("aria-label")?.match(/^Map cluster: (\d+) beacons, (\d+) people/);
          return counts ? Number(counts[1]) + Number(counts[2]) : 1;
        };
        const item = [...items].sort((a, b) => clusterSize(a) - clusterSize(b)).find((element) => {
          const bounds = element.getBoundingClientRect();
          const x = bounds.left + bounds.width / 2;
          const y = bounds.top + bounds.height / 2;
          if (
            bounds.width <= 0 || bounds.height <= 0 ||
            x < 0 || y < 0 || x >= innerWidth || y >= innerHeight
          ) return false;
          const hit = document.elementFromPoint(x, y);
          return !!hit && (hit === element || element.contains(hit));
        });
        if (!item) return null;
        const bounds = item.getBoundingClientRect();
        return {
          identity: item.getAttribute(attribute) ?? item.getAttribute("title") ?? "",
          x: bounds.left + bounds.width / 2,
          y: bounds.top + bounds.height / 2,
          scale: document.querySelector(".leaflet-control-scale-line")?.textContent?.trim() ?? "",
          memberCount: document.querySelectorAll('.leaflet-marker-icon[title^="Map:"]').length,
        };
      }, identityAttribute);
      const nextSignature = marker && marker.identity && marker.scale
        ? JSON.stringify({ ...marker, x: marker.x.toFixed(1), y: marker.y.toFixed(1) })
        : "";
      stableSamples = nextSignature && nextSignature === signature ? stableSamples + 1 : 1;
      signature = nextSignature;
      return nextSignature ? stableSamples : 0;
    }, { message: "a marker, map scale, and membership must settle with its center unobstructed", intervals: [150] })
    .toBeGreaterThanOrEqual(4);
  return marker!;
}

test("a map cluster expands to its bounds and member pins open the synchronized preview", async ({
  page,
}) => {
  await startDemo(page);
  // Initial fit can regroup the first rendered clusters. Select an actual
  // visible cluster only after its identity, geometry, scale, and members settle.
  let settledCluster = await findStableUnobstructedMarker(
    page, 'button[aria-label^="Map cluster:"]', "aria-label",
  );
  const scaleLine = page.locator(".leaflet-control-scale-line").first();
  const markers = page.locator('.leaflet-marker-icon[title^="Map:"]');
  const markersBeforeExpansion = settledCluster.memberCount;
  // A large initial cluster can first split into smaller clusters. Keep the
  // real expansion checks while walking at most four settled, reachable groups.
  for (let expansion = 0; expansion < 4; expansion += 1) {
    const cluster = page.getByRole("button", { name: settledCluster.identity, exact: true }).last();
    await expect(cluster).toBeVisible();
    await expect(cluster).toHaveAccessibleName(/Preview:/);
    await expect(cluster).toHaveAccessibleName(/Category mix:/);
    const clusterCenter = await cluster.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const hit = document.elementFromPoint(x, y);
      return {
        x,
        y,
        unobstructed: !!hit && (hit === element || element.contains(hit)),
        viewport: x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight,
      };
    });
    expect(clusterCenter.viewport).toBe(true);
    expect(clusterCenter.unobstructed).toBe(true);
    const scaleBeforeExpansion = settledCluster.scale;
    await page.mouse.click(clusterCenter.x, clusterCenter.y);
    await expect
      .poll(async () => (await scaleLine.textContent())?.trim())
      .not.toBe(scaleBeforeExpansion);
    const settledMap = await findStableUnobstructedMarker(
      page, 'button[aria-label^="Map cluster:"], .leaflet-marker-icon[title^="Map:"]', "aria-label",
    );
    if (settledMap.memberCount > markersBeforeExpansion) break;
    if (expansion < 3) {
      settledCluster = await findStableUnobstructedMarker(
        page, 'button[aria-label^="Map cluster:"]', "aria-label",
      );
    }
  }
  expect(await markers.count()).toBeGreaterThan(markersBeforeExpansion);
  await expect(page.getByRole("button", { name: /^Map: / }).first()).toBeVisible();
  await expect(page.getByTestId("map-cluster-panel")).toHaveCount(0);

  const memberPin = await findStableUnobstructedMarker(
    page, '.leaflet-marker-icon[title^="Map:"]', "title",
  );
  // Use the exact center already verified by elementFromPoint. Locator.click()
  // can choose another visible-point candidate after Leaflet transitions and
  // hit the surrounding sheet even though this marker center is clear.
  await page.mouse.click(memberPin.x, memberPin.y);
  const preview = page.getByTestId("map-tooltip").getByTestId("map-tooltip-card").first();
  await expect(preview).toBeVisible();
  await expect(preview.getByRole("button", {
    name: `Open ${memberPin.identity.slice("Map: ".length)} Beacon details`, exact: true,
  }).first()).toBeVisible();
  await expect(preview).toContainText("going");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: test.info().outputPath("map-cluster-expanded-preview-390.png") });

  await page.locator(".leaflet-container").click({ position: { x: 120, y: 260 } });
  await expect(page.getByTestId("map-tooltip")).toHaveCount(0);
});

test("Draw-created Beacon links back to its decision", async ({ page }) => {
  await startDemo(page);
  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
  await page.getByRole("button", { name: "Upcoming", exact: true }).click();
  await page
    .getByRole("button", {
      name: "View A surprise crew meetup details",
      exact: true,
    })
    .click();

  await expect(page.getByTestId("map-tooltip")).toBeVisible();
  await page
    .getByTestId("map-tooltip")
    .getByRole("button", {
      name: "Open A surprise crew meetup Beacon details",
      exact: true,
    })
    .first()
    .click();
  await expect(page).toHaveURL(/\/activity\/demo-draw-beacon(?:\?.*)?$/);
  await expect(
    page.getByRole("button", { name: "View Draw decision", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "View Draw decision", exact: true })
    .click();

  await expect(page).toHaveURL(/\/council\/demo-draw-result$/);
  await expect(page.getByText(/Crew.?s surprise meetup/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open beacon", exact: true }),
  ).toBeVisible();
});
