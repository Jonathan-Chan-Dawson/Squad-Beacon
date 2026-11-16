import { expect, test, type Page } from "@playwright/test";

async function enter(page: Page, width: number, appearance: "light" | "dark") {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(
    (mode) => localStorage.setItem("beacon.appearance", mode),
    appearance,
  );
  await page.goto("/activity/demo-tools?tab=tools");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await expect(page.getByTestId("beacon-tool-picker")).toBeVisible();
}
for (const [width, appearance] of [
  [320, "light"],
  [390, "dark"],
  [1024, "light"],
  [1440, "dark"],
] as const) {
  test(`readable tool picker and focused workspace ${width}px ${appearance}`, async ({
    page,
  }) => {
    await enter(page, width, appearance);
    await expect(
      page.getByRole("tab", { name: "Activity schedule", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.expo/beacon-redesign-tools-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("tab", { name: "Activity schedule", exact: true })
      .click();
    await expect(page.getByTestId("beacon-activity-schedule")).toBeVisible();
    if (width >= 1024) {
      await expect(
        page.getByRole("tab", { name: "Activity schedule", exact: true }),
      ).toHaveAttribute("aria-selected", "true");
      await page.screenshot({
        path: `.expo/beacon-redesign-workspace-${width}.png`,
        fullPage: true,
      });
    }
    if (width < 1024)
      await expect(page.getByTestId("beacon-tool-picker")).toHaveCount(0);
    if (width < 1024)
      await page
        .getByRole("button", { name: "All tools", exact: true })
        .click();
    await page.getByRole("tab", { name: "Timer", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Focus setup", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Session goal · optional", { exact: true }),
    ).toHaveCount(0);
    await page.getByRole("tab", { name: "People", exact: true }).click();
    await expect(page.getByTestId("beacon-hosting-workspace")).toBeVisible();
    await expect(
      page.getByRole("switch", {
        name: "Activity schedule reminders",
        exact: true,
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.expo/beacon-redesign-people-${width}.png`,
      fullPage: true,
    });
  });
}
test("schedule editing is focused and cancelling preserves saved stages", async ({
  page,
}) => {
  await enter(page, 390, "light");
  await page.getByTestId("activity-detail-hero").evaluate((node) => {
    let fiber = (node as any)[
      Object.keys(node).find((k) => k.startsWith("__reactFiber"))!
    ];
    while (fiber && !fiber.memoizedProps?.value?.data?.is_demo)
      fiber = fiber.return;
    fiber.memoizedProps.value.setDemoTier("pro");
  });
  await page
    .getByRole("tab", { name: "Activity schedule", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Edit schedule", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Schedule presets", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Use Study schedule", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save schedule", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Edit schedule", exact: true })
    .click();
  await page
    .getByRole("button", { name: "1. Prepare materials", exact: true })
    .click();
  await page.getByLabel("Stage title", { exact: true }).fill("Unsaved change");
  await page
    .getByRole("button", { name: "Cancel editing", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Discard schedule changes?", exact: true })
    .getByRole("button", { name: "Discard changes", exact: true })
    .click();
  await expect(
    page.getByText("Prepare materials", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Unsaved change", { exact: true })).toHaveCount(
    0,
  );
  await page.screenshot({
    path: ".expo/beacon-redesign-schedule.png",
    fullPage: true,
  });
});
