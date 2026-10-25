import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
});

test("Find a Time saves independent answers and finalizes without publishing", async ({
  page,
}) => {
  await page.getByRole("tab", { name: "Squads", exact: true }).click();
  await page
    .getByRole("button", { name: /Responses & Invitations, \d+ pending/ })
    .click();
  await page.getByRole("button", { name: "+ New", exact: true }).click();
  await page.getByRole("button", { name: "Find a Time", exact: true }).click();
  await page
    .getByLabel("Activity title", { exact: true })
    .fill("Find a court time");
  await page
    .getByRole("button", { name: "Create Find a Time", exact: true })
    .click();
  await expect(page).toHaveURL(/responses/);
  await expect(
    page.getByRole("button", { name: "Decisions", exact: true }),
  ).toBeVisible();
  const row = page
    .getByRole("button", { name: "Open Find a court time", exact: true })
    .locator("..");
  await expect(row).toBeVisible();
  if (
    await row.getByRole("button", { name: "Choose Times", exact: true }).count()
  )
    await row
      .getByRole("button", { name: "Choose Times", exact: true })
      .click();
  await row.getByRole("radio", { name: "Yes", exact: true }).first().click();
  await row.getByRole("radio", { name: "Maybe", exact: true }).nth(1).click();
  await row
    .getByRole("button", { name: "Save Availability", exact: true })
    .click();
  await expect(row.getByText(/1 Yes · 0 Maybe · 0 No/).first()).toBeVisible();
  await row
    .getByRole("button", { name: "Select final time", exact: true })
    .click();
  await row
    .getByRole("radiogroup", { name: "Final time", exact: true })
    .getByRole("radio")
    .first()
    .click();
  await row.getByRole("button", { name: "Confirm time", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y + box!.height / 2).toBeCloseTo(844 / 2, -1);
  await dialog
    .getByRole("button", { name: "Use this time", exact: true })
    .click();
  await expect(
    row.getByRole("button", { name: "Review & Create Beacon", exact: true }),
  ).toBeVisible();
  await expect(
    row.getByRole("button", { name: "View Beacon", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({ path: ".expo/connected-time-selected.png" });
  await row
    .getByRole("button", { name: "Review & Create Beacon", exact: true })
    .click();
  await expect(page).toHaveURL(/create/);
  await expect(page.getByRole("textbox").first()).toHaveValue(
    "Find a court time",
  );
});

test("approval choices require Save and retain multiple saved choices", async ({
  page,
}) => {
  await page.getByRole("tab", { name: "Squads", exact: true }).click();
  await page
    .getByRole("button", { name: /Responses & Invitations, \d+ pending/ })
    .click();
  await page.getByRole("button", { name: "+ New", exact: true }).click();
  await page.getByRole("button", { name: "Vote", exact: true }).click();
  await page
    .getByLabel("What are we deciding?", { exact: true })
    .fill("Choose our next activity");
  const titles = page.getByLabel("Activity option", { exact: true });
  await titles.nth(0).fill("Bowling");
  await titles.nth(1).fill("Coffee");
  await page
    .getByRole("button", { name: "I'm Good With…", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Create Vote Council", exact: true })
    .click();
  await expect(page).toHaveURL(/activity-created/);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Approve Bowling", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Approve Coffee", exact: true })
    .click();
  await expect(page.getByRole("checkbox").first()).toBeVisible();
  await page.getByRole("checkbox").nth(0).click();
  await page.getByRole("checkbox").nth(1).click();
  await expect(
    page.getByRole("button", { name: "Save Choices", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save Choices", exact: true }).click();
  await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "Update Choices", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: ".expo/connected-approval.png" });
});

test("source result exposes canonical participation and direct Beacon access", async ({
  page,
}) => {
  await page.getByRole("tab", { name: "Squads", exact: true }).click();
  await page
    .getByRole("button", { name: /Responses & Invitations, \d+ pending/ })
    .click();
  await page.getByRole("button", { name: "History", exact: true }).click();

  const links = page.getByRole("button", { name: "View Beacon", exact: true });
  await expect(links.first()).toBeVisible();
  await links.first().click();
  await expect(page).toHaveURL(/activity\//);
});
