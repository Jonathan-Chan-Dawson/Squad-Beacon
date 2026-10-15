import { expect, test } from "@playwright/test";

test("Squad messages and profiles show group icons and retain real mini avatars for people", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("tab", { name: "Squads", exact: true }).click();
  const identity = page.getByRole("button", {
    name: "Open squad profile avatar The training crew",
    exact: true,
  });
  await expect(
    identity.getByTestId("community-avatar-squad-users"),
  ).toBeVisible();
  await expect(identity).not.toContainText("TT");
  await page
    .getByRole("button", { name: "Message The training crew", exact: true })
    .click();
  const header = page.getByRole("button", {
    name: "Open Squad profile for The training crew",
    exact: true,
  });
  await expect(
    header.getByTestId("community-avatar-squad-users"),
  ).toBeVisible();
  await header.click();
  await expect(
    page.getByRole("img", { name: "Squad icon: People", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('[data-testid="user-avatar"]:visible').first(),
  ).toBeVisible();
});

test("an owner can choose a Squad icon once and it follows the profile, conversation and chat header", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("tab", { name: "Squads", exact: true }).click();
  await page
    .getByRole("button", { name: "New conversation", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Create a Squad", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Coffee icon crew");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Open squad profile avatar Coffee icon crew",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Squad settings", exact: true })
    .click();
  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  const choice = page.getByRole("button", {
    name: "Choose Coffee Squad icon",
    exact: true,
  });
  await choice.click();
  await expect(choice).toHaveAttribute("aria-selected", "true");
  await page.screenshot({ path: "test-results/squad-icon-picker-320.png" });
  await page
    .getByRole("button", { name: "Save Squad icon", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Save Squad icon", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "Squad icon: Coffee", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  const header = page.getByRole("button", {
    name: "Open Squad profile for Coffee icon crew",
    exact: true,
  });
  await expect(
    header.getByTestId("community-avatar-squad-coffee"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Message Coffee icon crew", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("button", {
        name: "Open squad profile avatar Coffee icon crew",
        exact: true,
      })
      .getByTestId("community-avatar-squad-coffee"),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/squad-chosen-icon-320.png" });
});
