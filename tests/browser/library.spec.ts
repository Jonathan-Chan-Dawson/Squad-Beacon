import { expect, test } from "@playwright/test";

test("shared beacon library files one card privately without duplicating content", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
  await page.getByRole("button", { name: "Past", exact: true }).click();
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await expect(page.getByText("Your library", { exact: true })).toBeVisible();
  const card = page.getByTestId("library-card-demo-tools");
  await expect(card).toBeVisible();
  await expect(card.getByText("1 entry · Unfiled", { exact: true })).toBeVisible();

  await page.getByLabel("Folder name", { exact: true }).fill("Weekend walks");
  await page.getByRole("button", { name: "Create folder", exact: true }).click();
  await page.getByRole("button", { name: "All", exact: true }).click();
  await card.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: "Move to Weekend walks", exact: true }).click();
  await expect(card.getByText("1 entry · Weekend walks", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Weekend walks", exact: true }).click();
  await expect(card).toBeVisible();

  await page.getByRole("tab", { name: "Checklists", exact: true }).click();
  const checklistCard = page.getByTestId("library-card-demo-tools");
  await expect(checklistCard.getByText("2 items · Unfiled", { exact: true })).toBeVisible();
  await expect(checklistCard).toHaveCount(1);
});
