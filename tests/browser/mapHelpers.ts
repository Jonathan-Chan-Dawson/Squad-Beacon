import { expect, type Page } from "@playwright/test";

export async function openBeaconFromMap(page: Page, title: string) {
  await page.getByRole("button", { name: "Open Beacon list", exact: true }).click();
  const row = page.getByRole("button", {
    name: `Select ${title} Beacon`,
    exact: true,
  });
  await expect(row).toBeVisible();
  await row.click();
  await page.getByRole("button", { name: "Return to map", exact: true }).click();
  const preview = page.getByTestId("map-tooltip");
  await expect(preview).toBeVisible();
  await expect(preview).toContainText(title);
}
