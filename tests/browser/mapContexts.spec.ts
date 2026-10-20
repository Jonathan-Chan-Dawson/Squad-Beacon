import { expect, test } from "@playwright/test";

for (const example of [
  {
    route: "/plan/demo-routine:demo-you:friday:plan",
    action: "Show Full Plan",
    chip: "Plan: Friday Night Routine · First plan",
  },
  {
    route: "/council/demo-draw-result",
    action: "Show Suggested Beacons",
    chip: "Draw: Crew’s surprise meetup",
  },
])
  test(`${example.action} focuses ${example.chip} on the current map`, async ({
    page,
  }) => {
    await page.goto(example.route);
    await page.getByRole("button", { name: /Explore the demo/ }).click();
    await page
      .getByRole("button", { name: example.action, exact: true })
      .click();
    const chip = page.getByRole("button", {
      name: `Remove ${example.chip} filter`,
      exact: true,
    });
    await expect(chip).toBeVisible();
    await expect(page.getByTestId("map-exploration-header")).toBeVisible();
    if (example.chip.startsWith("Draw:")) {
      const pin = page.locator(
        'button[aria-label^="Map: A surprise crew meetup"]',
      );
      await expect(pin).toBeVisible();
      await pin.click();
      await expect(page.getByTestId("map-tooltip")).toContainText(
        "A surprise crew meetup",
      );
      await page
        .getByTestId("map-tooltip")
        .getByRole("button", { name: "See overview", exact: true })
        .click();
      await expect(page).toHaveURL(/\/activity\//);
      await page
        .getByRole("button", { name: "View Draw decision", exact: true })
        .click();
      await expect(
        page.getByText("Beacon options", { exact: true }).filter({ visible: true }),
      ).toBeVisible();
      await expect(page.getByText(/\d+ votes · APPROVED/)).toHaveCount(0);
      await page.goBack();
      await expect(page).toHaveURL(/\/activity\//);
      await page.goBack();
      await expect(page.getByTestId("map-exploration-header")).toBeVisible();
      await expect(chip).toHaveCount(1);
    }
    await chip.click();
    await expect(chip).toHaveCount(0);
  });

test("suggested Beacon context is removable independently of normal filters", async ({
  page,
}) => {
  await page.goto("/council/demo-vote-weekend");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page
    .getByRole("button", { name: "Show Suggested Beacons", exact: true })
    .click();
  const context = page.getByRole("button", {
    name: "Remove Vote: Which weekend plan sounds best? filter",
    exact: true,
  });
  await expect(context).toBeVisible();
  await expect(
    page.getByRole("button", { name: "All", exact: true }),
  ).toBeVisible();
  await page.getByTestId("map-filter-toggle").click();
  const filters = page.getByRole("dialog", { name: "Filters", exact: true });
  await filters.getByRole("button", { name: "Study", exact: true }).click();
  await filters.getByRole("button", { name: /^Show \d+ Beacons$/ }).click();
  await expect(context).toBeVisible();
  await context.click();
  await expect(context).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Remove Study filter", exact: true }),
  ).toBeVisible();
});

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test(`existing filter menu stays centered and usable at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.getByRole("button", { name: /Explore the demo/ }).click();
    await page.getByTestId("map-filter-toggle").click();
    const filters = page.getByRole("dialog", { name: "Filters", exact: true });
    await expect(filters).toBeVisible();
    const close = filters.getByRole("button", { name: "Close", exact: true });
    const results = filters.getByRole("button", { name: /^Show \d+ Beacons$/ });
    await expect(close).toBeInViewport();
    await expect(results).toBeInViewport();
    await expect
      .poll(async () => {
        const top = await close.boundingBox();
        const bottom = await results.boundingBox();
        return (
          !!top &&
          !!bottom &&
          top.y > 20 &&
          bottom.y + bottom.height < viewport.height - 20 &&
          Math.abs(
            (top.y + bottom.y + bottom.height) / 2 - viewport.height / 2,
          ) < 45
        );
      })
      .toBe(true);
    await filters
      .getByRole("button", { name: "More filters", exact: true })
      .scrollIntoViewIfNeeded();
    await filters
      .getByRole("button", { name: "More filters", exact: true })
      .click();
    await filters
      .getByRole("button", { name: "Starred only", exact: true })
      .scrollIntoViewIfNeeded();
    await filters
      .getByRole("button", { name: "Starred only", exact: true })
      .click();
    await expect(results).toBeInViewport();
    await page.screenshot({
      path: `test-results/map-context-filters-${viewport.width}.png`,
    });
    await results.click();
    await expect(filters).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: "Remove Starred only filter",
        exact: true,
      }),
    ).toBeVisible();
  });
}
