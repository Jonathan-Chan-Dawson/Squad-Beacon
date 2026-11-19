import { startDemoFromEntry } from "./demoEntry";
import { expect, test } from "@playwright/test";

for (const appearance of ["light", "dark"]) {
  test(`Phase F agenda, hosting and consent work at phone width · ${appearance}`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 320, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(
      (mode) => localStorage.setItem("beacon.appearance", mode),
      appearance,
    );
    await page.goto("/activity/demo-tools?tab=activity&tool=checklist");
    await startDemoFromEntry(page);
    await page.getByRole("button", { name: "All tools", exact: true }).click();
    await page
      .getByRole("tab", { name: "Activity schedule", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Edit schedule", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Save schedule", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Explore BEACON+ benefits", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Demo tier: Pro", exact: true })
      .click();
    await page.goBack();
    await page
      .getByRole("button", { name: "Schedule presets", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Use Study schedule", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Save schedule", exact: true })
      .click();
    await expect(
      page.getByText("Prepare materials", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: "Start stage: Prepare materials",
        exact: true,
      })
      .click();
    await expect(page.getByTestId("beacon-activity-schedule")).toContainText(
      "In progress",
    );
    await expect(
      page.getByRole("button", { name: "Edit schedule", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `.expo/beacon-expansion-agenda-${appearance}.png`,
      fullPage: true,
    });
    await page.getByRole("tab", { name: "Overview", exact: true }).click();
    await expect(page.getByTestId("beacon-preparation-summary")).toContainText(
      "Prepare materials",
    );
    await page.getByRole("tab", { name: "People", exact: true }).click();
    await page
      .getByRole("button", { name: "Hosting settings", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Configure hosting", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Add RSVP question", exact: true })
      .click();
    await page
      .getByLabel("RSVP question", { exact: true })
      .fill("What will you prepare?");
    await page
      .getByRole("button", { name: "Check-in on", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Save hosting settings", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Your RSVP details", exact: true })
      .click();
    await page
      .getByLabel("What will you prepare?", { exact: true })
      .fill("Study notes");
    await page
      .getByRole("button", { name: "Save RSVP details", exact: true })
      .click();
    await expect(
      page.getByLabel("What will you prepare?", { exact: true }),
    ).toHaveValue("Study notes");
    await page
      .getByRole("switch", { name: "Activity schedule reminders", exact: true })
      .click();
    await expect(
      page.getByRole("switch", {
        name: "Activity schedule reminders",
        exact: true,
      }),
    ).not.toBeChecked();
    await page.screenshot({
      path: `.expo/beacon-expansion-hosting-${appearance}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("tab", { name: "Overview", exact: true }).click();
    await page
      .getByRole("button", { name: "Open memory collections", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Albums & Afterglow", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "Allow my name in activity recaps",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Remove my recap consent",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Remove my recap consent", exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Allow my name in activity recaps",
        exact: true,
      }),
    ).toBeVisible();
  });
}

test("round scoring and a consented timeline recap use the existing tools", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/activity/demo-tools?tab=activity&tool=checklist");
  await startDemoFromEntry(page);
  await page.getByTestId("activity-detail-hero").evaluate(async (node) => {
    let fiber = (node as any)[
      Object.keys(node).find((k) => k.startsWith("__reactFiber"))!
    ];
    while (fiber && !fiber.memoizedProps?.value?.data?.is_demo)
      fiber = fiber.return;
    const store = fiber.memoizedProps.value;
    store.setDemoTier("pro");
    await store.act("set_beacon_controls", {
      activity_id: "demo-tools",
      enable_scoreboard: true,
    });
  });
  await page.getByRole("button", { name: "All tools", exact: true }).click();
  await page.getByRole("tab", { name: "Teams & scores", exact: true }).click();
  await page.getByLabel(/New team name/).fill("Study crew");
  await page.getByRole("button", { name: "Create team", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Live Activity · Scoring rounds",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Configure scoring rounds", exact: true })
    .click();
  await page
    .getByLabel("Scoring rounds · one per line", { exact: true })
    .fill("Practice\nFinal");
  await page
    .getByRole("button", { name: "Save scoring rounds", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "+1 round points for Study crew",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Study crew · 1 this round · 1 total", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: ".expo/beacon-expansion-rounds.png",
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Overview", exact: true }).click();
  await page
    .getByRole("button", { name: "Open memory collections", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Albums & Afterglow", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Allow my name in activity recaps",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Create album or recap", exact: true })
    .click();
  await page.getByRole("button", { name: "Afterglow", exact: true }).click();
  await page
    .getByRole("button", { name: "Recap layout: Timeline", exact: true })
    .click();
  await page
    .getByLabel("Recap title", { exact: true })
    .fill("Study highlights");
  await page
    .getByLabel("Introduction · optional", { exact: true })
    .fill("We reviewed the material together and planned our next session.");
  await page.getByRole("button", { name: /^Credit / }).click();
  await page.getByRole("button", { name: "Save recap", exact: true }).click();
  await expect(
    page.getByText("Study highlights", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Remove my recap consent", exact: true })
    .click();
  await expect(page.getByText(/^With /)).toHaveCount(0);
  await page.screenshot({
    path: ".expo/beacon-expansion-recap.png",
    fullPage: true,
  });
});
