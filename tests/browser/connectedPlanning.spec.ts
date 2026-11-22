import { test, expect } from "@playwright/test";
import { startDemoFromEntry } from "./demoEntry";

test.beforeEach(async ({ page }) => {
  await page.goto("/auth/sign-in");
  await startDemoFromEntry(page);
});

for (const width of [320, 390, 1100]) {
test(`Find a Time saves independent answers and finalizes without publishing at ${width}px`, async ({
  page,
}) => {
  await page.setViewportSize({ width, height: 844 });
  await page.getByRole("tab", { name: "Squads", exact: true }).click();
  await page
    .getByRole("button", { name: /Responses & Invitations, \d+ pending/ })
    .click();
  await page.getByRole("button", { name: "+ New", exact: true }).click();
  await page.getByRole("button", { name: "Find a Time", exact: true }).click();
  await page
    .getByLabel("What are you planning?", { exact: true })
    .fill("Find a court time");
  const send = page.getByRole("button", { name: "Send Time Poll", exact: true });
  await send.click();
  await expect(page.getByText("Choose 2 to 10 proposed times.")).toBeVisible();
  const addTime = page.getByRole("button", { name: "Add a time", exact: true });
  await addTime.click();
  const timePicker = page.getByRole("dialog", { name: "Add a time", exact: true });
  await timePicker.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("button", { name: /· Edit time$/ })).toHaveCount(0);
  for (let i = 0; i < 2; i++) {
    await addTime.click();
    await timePicker.getByRole("button", { name: "Add this time", exact: true }).click();
  }
  await expect(page.getByRole("button", { name: /· Edit time$/ })).toHaveCount(2);
  await send.click();
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
  const option = row.getByTestId(/^time-option-/).first();
  const group = option.getByRole("radiogroup");
  const optionBox = await option.boundingBox();
  const groupBox = await group.boundingBox();
  expect(Math.abs(groupBox!.x + groupBox!.width / 2 - optionBox!.x - optionBox!.width / 2)).toBeLessThan(2);
  expect(groupBox!.width).toBeLessThanOrEqual(360);
  expect(optionBox!.height).toBeLessThan(160);
  for (const name of ["Yes", "Maybe", "No"]) {
    const box = await group.getByRole("radio", { name, exact: true }).boundingBox();
    await expect(group.getByRole("radio", { name, exact: true }).getByText(name, { exact: true })).toBeVisible();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(Math.abs(box!.y - groupBox!.y)).toBeLessThan(3);
  }
  await row.screenshot({ path: `.expo/time-responses-${width}.png`, animations: "disabled" });
  await row.getByRole("radio", { name: "Yes", exact: true }).first().click();
  const discard = row.getByRole("button", { name: "Discard changes", exact: true });
  await expect(discard).toBeVisible();
  await discard.click();
  await expect(row.getByRole("radio", { name: "Yes", exact: true }).first()).toHaveAttribute("aria-checked", "false");
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
    row.getByRole("button", { name: "Review Beacon", exact: true }),
  ).toBeVisible();
  await expect(
    row.getByRole("button", { name: "View Beacon", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({ path: ".expo/connected-time-selected.png" });
  await row
    .getByRole("button", { name: "Review Beacon", exact: true })
    .click();
  await expect(page).toHaveURL(/create/);
  await expect(page.getByRole("textbox").first()).toHaveValue(
    "Find a court time",
  );
});

}

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
    .getByRole("button", { name: "Choose any that work", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start Vote", exact: true })
    .click();
  await expect(page).toHaveURL(/activity-created/);
  await page.getByRole("button", { name: "Not Now", exact: true }).click();
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
