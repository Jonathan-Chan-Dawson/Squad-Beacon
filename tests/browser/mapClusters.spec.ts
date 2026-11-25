import { expect, test, type Page } from "@playwright/test";
import { mockOnboardingAccount } from "./onboardingAccount";
import { startDemoFromEntry } from "./demoEntry";

async function startDemo(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockOnboardingAccount(page, { signedOut: true });
  await page.goto("/auth/sign-in");
  await startDemoFromEntry(page);
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
    .poll(
      async () => {
        marker = await page
          .locator(selector)
          .evaluateAll((items, attribute) => {
            // Prefer a smaller reachable group when a broad cluster has split.
            const clusterSize = (element: Element) => {
              const counts = element
                .getAttribute("aria-label")
                ?.match(/^Map cluster: (\d+) beacons, (\d+) nearby friends/);
              return counts ? Number(counts[1]) + Number(counts[2]) : 1;
            };
            const item = [...items]
              // Small clusters open the compact list without search or tabs.
              .filter((element) => clusterSize(element) > 5)
              .sort((a, b) => clusterSize(a) - clusterSize(b))
              .find((element) => {
                const bounds = element.getBoundingClientRect();
                const x = bounds.left + bounds.width / 2;
                const y = bounds.top + bounds.height / 2;
                if (
                  bounds.width <= 0 ||
                  bounds.height <= 0 ||
                  x < 0 ||
                  y < 0 ||
                  x >= innerWidth ||
                  y >= innerHeight
                )
                  return false;
                const hit = document.elementFromPoint(x, y);
                return !!hit && (hit === element || element.contains(hit));
              });
            if (!item) return null;
            const bounds = item.getBoundingClientRect();
            return {
              identity:
                item.getAttribute(attribute) ??
                item.getAttribute("title") ??
                "",
              x: bounds.left + bounds.width / 2,
              y: bounds.top + bounds.height / 2,
              scale:
                document
                  .querySelector(".leaflet-control-scale-line")
                  ?.textContent?.trim() ?? "",
              memberCount: document.querySelectorAll(
                '.leaflet-marker-icon[title^="Map:"]',
              ).length,
            };
          }, identityAttribute);
        const nextSignature =
          marker && marker.identity && marker.scale
            ? JSON.stringify({
                ...marker,
                x: marker.x.toFixed(1),
                y: marker.y.toFixed(1),
              })
            : "";
        stableSamples =
          nextSignature && nextSignature === signature ? stableSamples + 1 : 1;
        signature = nextSignature;
        return nextSignature ? stableSamples : 0;
      },
      {
        message:
          "a marker, map scale, and membership must settle with its center unobstructed",
        intervals: [150],
      },
    )
    .toBeGreaterThanOrEqual(4);
  return marker!;
}

test("constellation opens searchable Beacons and nearby Friends and selects an exact item", async ({
  page,
}) => {
  await startDemo(page);
  await expect(
    page.getByRole("button", { name: "Navigation", exact: true }),
  ).toBeVisible();
  const settled = await findStableUnobstructedMarker(
    page,
    '[role="button"][data-testid="map-constellation"]:not([data-friend-count="0"])',
    "aria-label",
  );
  await page.screenshot({ path: test.info().outputPath("projector-map.png") });
  await page.mouse.click(settled.x, settled.y);
  const panel = page.getByTestId("map-nearby-panel");
  await expect(panel).toBeVisible();
  await expect(
    page.locator(".leaflet-control-scale-line").first(),
  ).toBeVisible();
  await expect(panel.getByRole("tab", { name: /^Beacons,/ })).toBeVisible();
  await expect(page.getByTestId("map-control-rail")).toHaveCount(0);
  await panel.screenshot({ path: test.info().outputPath("nearby.png") });
  await panel.getByRole("tab", { name: /^Friends,/ }).click();
  await expect(
    panel.getByRole("button", { name: /^View .* profile$/ }).first(),
  ).toBeVisible();
  await panel
    .getByRole("textbox", {
      name: "Search nearby Beacons and friends",
      exact: true,
    })
    .fill("no-person-matches-842312");
  await expect(
    panel.getByText("No matching friends.", { exact: true }),
  ).toBeVisible();
  await panel.getByRole("textbox").fill("");
  await panel
    .getByRole("button", { name: /^View .* profile$/ })
    .first()
    .click();
  await expect(page.getByTestId("map-person-preview")).toBeVisible();
  await expect(panel).toHaveCount(0);
  await expect(page.getByTestId("map-control-rail")).toBeVisible();
  const preview = await page.getByTestId("map-person-preview").boundingBox();
  expect(preview!.x).toBeGreaterThanOrEqual(16);
  expect(preview!.x + preview!.width).toBeLessThanOrEqual(374);
  await page.screenshot({
    path: test.info().outputPath("map-person-preview.png"),
  });
});

for (const width of [320, 390]) {
  test(`Beacon tools open from Map and save Scratchboard notes at ${width}px`, async ({
    page,
  }) => {
    await startDemo(page);
    await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
    const search = page.getByRole("textbox", {
      name: "Search places, Beacons, people and communities",
      exact: true,
    });
    await search.fill("Walk planning with the crew");
    await page
      .getByRole("button", {
        name: "Open Walk planning with the crew Beacon",
        exact: true,
      })
      .click();
    const preview = page.getByTestId("map-tooltip-card");
    await expect(
      preview.getByRole("button", { name: "See overview", exact: true }),
    ).toBeVisible();
    await preview.getByRole("button", { name: "See overview", exact: true }).click();
    await expect(page).toHaveURL(/\/activity\//);
    await page.getByRole("tab", { name: "Tools", exact: true }).click();
    await page.getByRole("tab", { name: "Scratchboard", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Your note", exact: true })
      .fill("Map Sketchboard draft saved from its tab");
    await page.getByRole("button", { name: "Save note", exact: true }).click();
    await page.getByRole("button", { name: "All tools", exact: true }).click();
    await page.getByRole("tab", { name: "Checklist", exact: true }).click();
    await expect(
      page.getByRole("checkbox", {
        name: "Check Bring a water bottle",
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "All tools", exact: true }).click();
    await page
      .getByRole("tab", { name: "Scratchboard", exact: true })
      .click();
    await expect(
      page.getByRole("textbox", { name: "Your note", exact: true }),
    ).toHaveValue("Map Sketchboard draft saved from its tab");
    await page.screenshot({
      path: test.info().outputPath("map-sketchboard-panel.png"),
    });
    await page.goBack();
    await expect(page.getByTestId("full-map-screen")).toBeVisible();
  });
}

test("Draw-created Beacon links back to its decision", async ({ page }) => {
  await startDemo(page);
  await page
    .getByRole("textbox", {
      name: "Search places, Beacons, people and communities",
      exact: true,
    })
    .fill("A surprise crew meetup");
  await page
    .getByRole("button", {
      name: "Open A surprise crew meetup Beacon",
      exact: true,
    })
    .click();

  await expect(page.getByTestId("map-tooltip")).toBeVisible();
  await page
    .getByTestId("map-tooltip")
    .getByRole("button", { name: "See overview", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/activity\//);
  await expect(
    page.getByRole("button", { name: "View Draw decision", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "View Draw decision", exact: true })
    .click();

  await expect(page).toHaveURL(/\/responses\?threadId=demo-draw-result$/);
  await expect(page.getByText(/Crew.?s surprise meetup/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "View Beacon", exact: true }),
  ).toBeVisible();
});
