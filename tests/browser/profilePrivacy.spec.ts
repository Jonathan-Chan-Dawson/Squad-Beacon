import { expect, test, type Page } from "@playwright/test";

async function enterDemo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
}

test("profile visibility is saved in actual settings with custom audience choices", async ({
  page,
}) => {
  await enterDemo(page);
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await page
    .getByRole("button", { name: "Manage profile visibility", exact: true })
    .click();
  await expect(page.getByText("Who can see your full profile?", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/People who can already find you in the app/),
  ).toBeVisible();

  await page.getByRole("button", { name: "Full profile audience: Friends", exact: true }).click();
  await expect(
    page.getByText("Only people you have accepted as friends.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Full profile audience: Custom", exact: true }).click();
  await expect(page.getByText("Chosen people", { exact: true })).toBeVisible();
  await page.getByLabel("Find a person", { exact: true }).fill("Maya");
  const maya = page.getByRole("checkbox", { name: "Maya Chen", exact: true });
  await expect(maya).toHaveAttribute("aria-checked", "false");
  await maya.click();
  await expect(maya).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Save profile privacy", exact: true }).click();

  await page.getByRole("button", { name: "Back to profile", exact: true }).click();
  await page
    .getByRole("button", { name: "Manage profile visibility", exact: true })
    .click();
  await expect(page.getByText("✓ Custom", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Maya Chen", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
});
