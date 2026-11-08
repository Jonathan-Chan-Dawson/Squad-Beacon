import { expect, test } from "@playwright/test";

for (const appearance of ["dark", "light"] as const) {
  test(`start an undated Plan, evolve its timeline, and reopen it · ${appearance}`, async ({
    page,
  }) => {
    await page.addInitScript(
      (mode) => localStorage.setItem("beacon.appearance", mode),
      appearance,
    );
    if (appearance === "light")
      await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/plans");
    await page.getByRole("button", { name: /Explore the demo/ }).click();
    await page.getByRole("button", { name: "+ New Plan", exact: true }).click();
    await page
      .getByLabel("Plan title", { exact: true })
      .fill("Saturday tiny adventure");
    await page.getByRole("button", { name: "Add Idea", exact: true }).click();
    await page.getByLabel("Activity idea", { exact: true }).fill("Try a cafe");
    await page
      .getByRole("button", { name: "Activity options", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Duplicate as draft", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "2. Try a cafe", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Save Draft", exact: true }).click();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(
      page.getByRole("tab", { name: "Plans", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await page
      .getByRole("button", { name: "Saturday tiny adventure", exact: true })
      .last()
      .click();
    await expect(
      page.getByRole("button", { name: "1. Try a cafe", exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/Quick idea · unscheduled/)).toHaveCount(2);
    await expect(page.getByText(/Linked Beacon/)).toHaveCount(0);
    for (const width of [320, 390, 430, 1024]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(
        page.getByRole("button", { name: "Add Idea", exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
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
  await page.goto("/create");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("button", { name: "Create Plan", exact: true }).click();
  await page
    .getByLabel("Plan title", { exact: true })
    .fill("Decide our afternoon");
  await page.getByRole("button", { name: "Add Decision", exact: true }).click();
  await page.getByRole("button", { name: "Ping", exact: true }).click();
  await page
    .getByLabel("What are you thinking?", { exact: true })
    .fill("Cafe or walk?");
  await page.getByRole("button", { name: "Create Ping", exact: true }).click();
  await expect(page).toHaveURL(/\/plan\//);
  await expect(
    page.getByRole("button", { name: "1. Cafe or walk?", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Decision", { exact: true })).toBeVisible();
});

test("repeat a favorite Beacon through the shared inline Routine editor", async ({
  page,
}) => {
  const { makeDemo, DEMO_ID } = await import("../../src/shared/demo");
  const activity = makeDemo().activities.find(
    (a) =>
      a.owner_id === DEMO_ID && a.mode !== "solo" && a.status !== "cancelled",
  )!;
  await page.goto(`/activity/${encodeURIComponent(activity.id)}?repeat=yes`);
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await expect(page.getByTestId("inline-routine-editor")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Weekly", exact: true }).click();
  await page.getByRole("button", { name: "Save Repeat", exact: true }).click();
  await expect(page.getByText(/Active · Next/)).toBeVisible();
  await expect(page).toHaveURL(/\/activity\//);
  await page.getByRole("button", { name: "Monthly", exact: true }).click();
  await expect(
    page.getByText("Upcoming Repeats", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save Schedule", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Repeat options", exact: true })
    .click();
  await page.getByRole("button", { name: "Run Now", exact: true }).click();
  await expect(page).toHaveURL(/\/plan\//);
  await expect(page.getByText(/Linked Beacon/)).toBeVisible();
});
