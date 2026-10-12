import { expect, test } from "@playwright/test";

async function createHome(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Create Blank Template", exact: true }),
  ).toBeVisible();
}

test("Create stays compact and app templates prefill the Beacon Quick Editor", async ({
  page,
}) => {
  await createHome(page);
  await expect(
    page.getByLabel("Title / Activity", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Browse More Templates", exact: true })
    .click();
  await page.getByLabel("Search", { exact: true }).fill("Basketball");
  await page.getByRole("button", { name: "Basketball", exact: true }).click();
  await expect(
    page.getByLabel("Title / Activity", { exact: true }),
  ).toHaveValue("Basketball");
  await expect(
    page.getByRole("button", { name: "Create Beacon", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("A few helpful details", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Advanced Options ↓", exact: true })
    .click();
  await expect(
    page.getByText("A few helpful details", { exact: true }),
  ).toBeVisible();
});

test("Plan timeline can create a reusable manual Routine", async ({ page }) => {
  await createHome(page);
  await page.getByRole("button", { name: "Plan", exact: true }).click();
  await page.getByRole("button", { name: "+ Blank Plan", exact: true }).click();
  await page
    .getByLabel("Plan name", { exact: true })
    .fill("Friday test itinerary");
  await page
    .getByLabel("Title / Activity", { exact: true })
    .fill("Dinner test");
  await page.getByRole("button", { name: "Manual Start", exact: true }).click();
  await page.getByRole("button", { name: "Manual End", exact: true }).click();
  await page.getByRole("button", { name: "+ Add Beacon", exact: true }).click();
  await page
    .getByLabel("Title / Activity", { exact: true })
    .fill("Bowling test");
  await expect(
    page.getByRole("button", { name: "After Previous Ends", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Create Plan", exact: true }).click();
  const conflicts = page.getByRole("button", {
    name: "Create Plan anyway",
    exact: true,
  });
  if (await conflicts.isVisible()) await conflicts.click();
  await expect(page).toHaveURL(/\/plan\//);
  await expect(
    page.getByText("Dinner test", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Start Beacon", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "End Beacon", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Make This a Routine", exact: true })
    .click();
  await page.getByRole("button", { name: "Run Manually", exact: true }).click();
  await page
    .getByRole("button", { name: "Create Routine", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Open Routine tools", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Open Routine tools", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Run Now", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Run Now", exact: true }).click();
  await expect(page).toHaveURL(/\/plan\//);
});

test("Routine quick start offers source Plans and the shared Plan builder", async ({
  page,
}) => {
  await createHome(page);
  await page.getByRole("button", { name: "Routine", exact: true }).click();
  await expect(page.getByText("FOR YOU", { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "+ Create Routine", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Build a Plan from scratch", exact: true })
    .click();
  await expect(page.getByLabel("Plan name", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Next · Repeat Schedule", exact: true }),
  ).toBeVisible();
});

test("a Suggested Beacon creates a Vote and can add another suggestion with the Quick Editor", async ({
  page,
}) => {
  await createHome(page);
  await page
    .getByLabel("Search activities", { exact: true })
    .fill("Coffee together");
  await page
    .getByRole("button", { name: "Coffee together", exact: true })
    .click();
  await page
    .getByLabel("Title / Activity", { exact: true })
    .fill("Coffee suggestion test");
  await page.getByRole("button", { name: "Now", exact: true }).click();
  await page.getByRole("button", { name: "In 30 min", exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Vote / Draw", exact: true }).click();
  await page
    .getByLabel("Decision name (optional)", { exact: true })
    .fill("Friday choices test");
  await page
    .getByRole("button", { name: "Add Suggested Beacon", exact: true })
    .click();
  await expect(page).toHaveURL(/\/council\//);
  await expect(
    page.getByText("Coffee suggestion test", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "+ Suggested Beacon", exact: true })
    .click();
  await page
    .getByLabel("Title / Activity", { exact: true })
    .fill("Bowling suggestion test");
  await page
    .getByRole("button", { name: "Add Suggested Beacon", exact: true })
    .click();
  await expect(page).toHaveURL(/\/council\//);
  await expect(
    page
      .getByText("Bowling suggestion test", { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
});

test("launcher preserves blank first, recommendations, search, and compact family navigation", async ({
  page,
}) => {
  await createHome(page);
  const blank = page.getByRole("button", {
    name: "Create Blank Template",
    exact: true,
  });
  const forYou = page.getByText("FOR YOU", { exact: true });
  expect((await blank.boundingBox())!.y).toBeLessThan(
    (await forYou.boundingBox())!.y,
  );
  await page.getByLabel("Search activities", { exact: true }).fill("groceries");
  await expect(
    page.getByRole("button", { name: "Grocery Run", exact: true }),
  ).toBeVisible();
  await expect(forYou).toHaveCount(0);
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await page.screenshot({ path: "test-results/create-launcher-390.png" });
  await page
    .getByRole("button", { name: "Browse More Templates", exact: true })
    .click();
  const browser = page.getByRole("dialog");
  await expect(
    browser.getByRole("button", { name: "Hangout", exact: true }),
  ).toBeVisible();
  await expect(
    browser.getByRole("button", { name: "Photography & Content", exact: true }),
  ).toHaveCount(1);
  await browser
    .getByRole("button", { name: "Errands & Shopping", exact: true })
    .click();
  await expect(
    browser.getByRole("button", { name: "Grocery Run", exact: true }),
  ).toBeVisible();
  await browser
    .getByRole("button", { name: "Back to categories", exact: true })
    .click();
  await browser
    .getByRole("button", { name: "Photography & Content", exact: true })
    .click();
  await expect(
    browser.getByRole("button", { name: "Outdoor Photography", exact: true }),
  ).toBeVisible();
  await browser
    .getByRole("button", { name: "Back to categories", exact: true })
    .click();
  await browser.getByLabel("Search", { exact: true }).fill("movie night");
  await browser.getByRole("button", { name: "Movie", exact: true }).click();
  await expect(
    page.getByLabel("Title / Activity", { exact: true }),
  ).toHaveValue("Movie");
  await page
    .getByLabel("Title / Activity", { exact: true })
    .fill("Movie at mine");
  await expect(
    page.getByLabel("Title / Activity", { exact: true }),
  ).toHaveValue("Movie at mine");
});

for (const preset of ["Grocery Run", "General Hangout"]) {
  test(`${preset} creates a Beacon with appropriate sheet tools`, async ({
    page,
  }) => {
    await createHome(page);
    await page.getByLabel("Search activities", { exact: true }).fill(preset);
    await page.getByRole("button", { name: preset, exact: true }).click();
    await page
      .getByRole("button", { name: "Create Beacon", exact: true })
      .click();
    await expect(page).toHaveURL(/beacon=/);
    await page
      .getByTestId("map-tooltip-card")
      .getByRole("button", { name: "See overview", exact: true })
      .click();
    const panel = page.getByTestId("map-panel");
    if (preset === "Grocery Run") {
      await panel.getByRole("tab", { name: "Tools", exact: true }).click();
      await expect(
        panel.getByRole("tab", { name: "Grocery List", exact: true }),
      ).toBeVisible();
      await expect(
        panel.getByText("Grocery List", { exact: true }),
      ).toHaveCount(2);
      await expect(
        panel.getByLabel("Add a checklist item", { exact: true }),
      ).toBeVisible();
      await expect(
        panel.getByRole("button", { name: "Add item", exact: true }),
      ).toBeVisible();
    } else {
      await expect(panel.getByRole("tab")).toHaveText([
        "Overview",
        "Chat",
        "People",
      ]);
    }
    await page
      .getByTestId("beacon-sheet-dismiss-area")
      .click({ position: { x: 5, y: 5 } });
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByText("RECENT", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: preset, exact: true }).first(),
    ).toBeVisible();
  });
}

test("My Templates saves, reuses, and edits the existing configuration", async ({
  page,
}) => {
  await createHome(page);
  await page
    .getByLabel("Search activities", { exact: true })
    .fill("Grocery Run");
  await page.getByRole("button", { name: "Grocery Run", exact: true }).click();
  await page
    .getByRole("button", { name: "Advanced Options ↓", exact: true })
    .click();
  await page
    .getByLabel("Save this as a template (optional name)", { exact: true })
    .fill("Weekly groceries");
  await page
    .getByRole("button", { name: "Save as template", exact: true })
    .click();
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByRole("button", { name: "My Templates", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Weekly groceries", exact: true })
    .click();
  await expect(
    page.getByLabel("Title / Activity", { exact: true }),
  ).toHaveValue("Grocery Run");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "← Blank or template", exact: true })
    .click();
  await page.getByRole("button", { name: "My Templates", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", {
      name: "Edit template Weekly groceries",
      exact: true,
    })
    .click();
  await page
    .getByLabel("Title / Activity", { exact: true })
    .fill("Groceries and supplies");
  await page
    .getByRole("button", { name: "Save template", exact: true })
    .click();
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByRole("button", { name: "My Templates", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Weekly groceries", exact: true })
    .click();
  await expect(
    page.getByLabel("Title / Activity", { exact: true }),
  ).toHaveValue("Groceries and supplies");
});

test("a preset Beacon can join an existing Plan through the same editor", async ({
  page,
}) => {
  await createHome(page);
  await page
    .getByLabel("Search activities", { exact: true })
    .fill("Grocery Run");
  await page.getByRole("button", { name: "Grocery Run", exact: true }).click();
  await page.getByRole("button", { name: "Plan", exact: true }).click();
  await page
    .getByRole("button", { name: /^Friday Night Routine.*First plan$/ })
    .click();
  await page.getByRole("button", { name: "1", exact: true }).click();
  await page
    .getByRole("button", { name: "Add Beacon to Plan", exact: true })
    .click();
  await expect(page).toHaveURL(/\/plan\//);
  await expect(
    page.getByText("Grocery Run", { exact: true }).first(),
  ).toBeVisible();
});
