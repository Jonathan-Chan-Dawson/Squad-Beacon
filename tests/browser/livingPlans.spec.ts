import { expect, test } from "@playwright/test";

for (const appearance of ["dark", "light"] as const) {
  test(`start an undated Plan, evolve its timeline, and reopen it · ${appearance}`, async ({
    page,
  }) => {
    await page.addInitScript((appearance) => {
      localStorage.setItem("beacon.appearance", appearance);
    }, appearance);
    if (appearance === "light")
      await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.getByRole("button", { name: /Explore the demo/ }).click();
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await page
      .getByRole("button", { name: "Create Plan", exact: true })
      .click();
    await page
      .getByLabel("Plan name", { exact: true })
      .fill("Saturday tiny adventure");
    await page.getByRole("button", { name: "Save Plan", exact: true }).click();
    await expect(
      page.getByText("No stops yet. What should we do first?", { exact: true }),
    ).toBeVisible();

    await page.getByRole("button", { name: "+ Idea", exact: true }).click();
    await page
      .getByLabel("What could we do?", { exact: true })
      .fill("Try a cafe");
    await page.getByRole("button", { name: "Add idea", exact: true }).click();
    await page
      .getByRole("button", { name: "1. Try a cafe", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Stop options", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Duplicate idea", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "2. Try a cafe", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page
      .getByRole("button", { name: "Saturday tiny adventure", exact: true })
      .last()
      .click();
    await expect(
      page.getByRole("button", { name: "1. Try a cafe", exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/Date undecided · 1 following/)).toBeVisible();
    await expect(page.getByText(/Confirmed Beacon/)).toHaveCount(0);
    for (const width of [320, 390, 430, 1024]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(
        page.getByRole("button", { name: "+ Idea", exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () =>
            Math.max(
              document.documentElement.scrollWidth,
              document.body.scrollWidth,
            ) <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/living-plans-${appearance}-${width}.png`,
        fullPage: true,
      });
    }
  });
}

test("a Plan decision uses the existing Ping composer and returns to its stop", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByRole("button", { name: "Create Plan", exact: true }).click();
  await page
    .getByLabel("Plan name", { exact: true })
    .fill("Decide our afternoon");
  await page.getByRole("button", { name: "Save Plan", exact: true }).click();
  await page.getByRole("button", { name: "+ Decide", exact: true }).click();
  await page.getByRole("button", { name: "Ping", exact: true }).click();
  await page
    .getByLabel("What are you thinking?", { exact: true })
    .fill("Cafe or walk?");
  await page.getByRole("button", { name: "Create Ping", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "1. Cafe or walk?", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Ping · Open", { exact: true })).toBeVisible();
});

test("repeat a favorite Beacon through the shared Routine editor", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page
    .getByRole("button", { name: "Create Routine", exact: true })
    .click();
  await page
    .getByRole("button", { name: /^Repeat Beacon ·/ })
    .first()
    .click();
  await expect(
    page.getByText(
      "You will host future repeats. The original Beacon stays unchanged.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Every week", exact: true }).click();
  await page
    .getByRole("button", { name: "Create Routine", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Run Now", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Future repeats", exact: true })
    .click();
  await expect(
    page.getByText(
      "Changes apply to repeats that have not been generated. Already generated and completed occurrences stay unchanged.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Not now", exact: true }).click();
  await page.getByRole("button", { name: "Run Now", exact: true }).click();
  await expect(
    page.getByText("This occurrence · Edit its Beacons individually", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Future repeats", exact: true }),
  ).toBeVisible();
});
