import { expect, test } from "@playwright/test";
import { startDemoFromEntry } from "./demoEntry";

for (const [width, theme] of [
  [320, "light"],
  [430, "dark"],
] as const) {
  test(`Signal Card layout and access at ${width}px in ${theme}`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(
      (appearance) => localStorage.setItem("beacon.appearance", appearance),
      theme,
    );
    await page.goto("/auth/sign-in");
    await startDemoFromEntry(page);
    await page.getByRole("tab", { name: "Beacons", exact: true }).click();
    await page
      .getByRole("button", { name: "Explore all →", exact: true })
      .click();
    const browse = page.getByTestId("browse-beacons-screen");
    const search = browse.getByTestId("browse-beacons-search");
    await search.fill("Coffee together");
    const planCard = browse.getByTestId(
      "discovery-beacon-card-map-plan-coffee",
    );
    await expect(planCard).toBeVisible();
    await expect(
      planCard.getByRole("button", {
        name: "Open Plan Coffee, art and a lakefront walk, stop 1 of 3",
        exact: true,
      }),
    ).toBeVisible();
    await expect(planCard.getByTestId("beacon-plan-position")).toHaveText(
      /^\d+\/\d+$/,
    );
    await expect(
      planCard.getByRole("progressbar", { name: "Beacon capacity" }),
    ).toBeVisible();
    await expect(
      planCard.getByRole("button", { name: /achievement|aspiration|reward/i }),
    ).toHaveCount(0);
    await expect(
      planCard.getByTestId("discovery-going-count").getByRole("button"),
    ).toHaveCount(0);
    const dock = planCard.getByTestId("discovery-card-actions");
    await expect(dock).toBeVisible();
    const primaryLabel = await dock
      .getByText("Open Beacon", { exact: true })
      .boundingBox();
    expect(primaryLabel?.height).toBeLessThan(26);
    await expect
      .poll(() =>
        dock.evaluate(
          (element) => element.scrollWidth <= element.clientWidth + 1,
        ),
      )
      .toBe(true);
    await planCard.screenshot({
      path: testInfo.outputPath("linked-beacon.png"),
    });

    await search.fill("photography");
    const publicCard = browse.getByTestId(
      "discovery-beacon-card-map-public-photo-walk",
    );
    await expect(publicCard).toBeVisible();
    await expect(
      publicCard.getByRole("button", { name: /join/i }),
    ).toBeVisible();
    await expect(
      publicCard.getByRole("button", { name: /^Beacon tools|^Open .+ chat$/ }),
    ).toHaveCount(0);
  });
}

test("Map keeps linked Plan utilities in order and carries Zoom to Fit into Plan Focus", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() =>
    localStorage.setItem(
      "beacon.map-device.v2",
      JSON.stringify({ hintsSeen: 3 }),
    ),
  );
  await page.goto("/auth/sign-in");
  await startDemoFromEntry(page);
  const search = page.getByRole("textbox", {
    name: "Search places, Beacons, people and communities",
    exact: true,
  });
  await search.fill("Plan stop 1: Coffee together");
  await page
    .getByTestId("map-search-results")
    .getByRole("button", {
      name: "Open Plan stop 1: Coffee together Beacon",
      exact: true,
    })
    .click();
  const preview = page.getByTestId("map-tooltip-card");
  await expect(preview).toBeVisible();
  const controls = [
    preview.getByRole("button", {
      name: "Open Plan Coffee, art and a lakefront walk, stop 1 of 3",
      exact: true,
    }),
    preview.getByRole("button", { name: "Zoom to Fit" }),
    preview.getByRole("button", { name: "Save Beacon" }),
    preview.getByRole("button", { name: "Close map preview" }),
  ];
  const bounds = await Promise.all(
    controls.map(async (control) => {
      await expect(control).toBeVisible();
      return (await control.boundingBox())!;
    }),
  );
  expect(bounds.map((box) => box.x)).toEqual(
    bounds.map((box) => box.x).sort((a, b) => a - b),
  );
  await preview.screenshot({ path: testInfo.outputPath("map-card.png") });
  await controls[1].click();
  await expect(preview).toHaveCount(0);
  await expect(
    page.getByText("Coffee, art and a lakefront walk", { exact: true }).first(),
  ).toBeVisible();
});
