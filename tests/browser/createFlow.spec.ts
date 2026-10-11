import { expect, test } from "@playwright/test";

async function createHome(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "+ Blank Beacon", exact: true }),
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
    .getByRole("button", { name: "Browse Beacon Templates →", exact: true })
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
    .getByRole("button", { name: "+ Blank Beacon", exact: true })
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
    page.getByText("Bowling suggestion test", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
});
