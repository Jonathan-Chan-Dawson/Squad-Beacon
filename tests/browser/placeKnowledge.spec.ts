import { expect, test, type Page } from "@playwright/test";

async function court(page: Page) {
  await page.getByRole("textbox", { name: "Search places, Beacons, people and communities", exact: true }).fill("Willow Courts");
  await page.getByRole("button", { name: "Explore Willow Courts", exact: true }).click();
  return page.getByTestId("live-update-place-preview");
}

test("one place preview supports useful tips, temporary interest, Beacon creation and existing Pings", async ({ page }) => {
  const failures: string[] = [];
  page.on("pageerror", (failure) => failures.push(failure.message));
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  const preview = await court(page);
  await expect(preview).toContainText("People are looking for pickup games nearby");
  await expect(preview).toContainText("12 people found this helpful");
  await preview.getByRole("button", { name: "Helpful", exact: true }).click();
  await expect(preview).toContainText("13 people found this helpful");
  await expect(preview.getByRole("button", { name: "Helpful ✓", exact: true })).toBeDisabled();
  await preview.getByRole("button", { name: "Still accurate", exact: true }).click();
  await expect(preview.getByRole("button", { name: "Accuracy confirmed", exact: true })).toBeDisabled();
  await preview.getByRole("button", { name: "Share something useful", exact: true }).click();
  await preview.getByRole("button", { name: "Interested in pickup games", exact: true }).click();
  await expect(preview.getByRole("button", { name: "Remove my interest", exact: true })).toBeVisible();
  await preview.getByRole("button", { name: "Remove my interest", exact: true }).click();
  await expect(preview.getByRole("button", { name: "Remove my interest", exact: true })).toHaveCount(0);
  await preview.getByRole("textbox", { name: "Useful place tip", exact: true }).fill("The south gate is easiest for groups.");
  await preview.getByRole("button", { name: "Save tip", exact: true }).click();
  await expect(preview).toContainText("The south gate is easiest for groups.");
  await preview.getByRole("button", { name: "More place tips", exact: true }).click();
  await preview.getByRole("button", { name: "Tip options", exact: true }).click();
  await preview.getByRole("button", { name: "Report tip", exact: true }).click();
  await expect(preview).not.toContainText("Courts open up after 8 PM");
  await page.screenshot({ path: "test-results/place-knowledge-phone.png" });
  await preview.getByRole("button", { name: "Ping People", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Question or decision", exact: true })).toHaveValue("Meet at Willow Courts");
  await expect(page.getByRole("button", { name: "Create ping or decision", exact: true })).toBeVisible();
  expect(failures).toEqual([]);
});

test("place creation reuses the Beacon form with venue coordinates and label", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  const preview = await court(page);
  await preview.getByRole("button", { name: "Create Beacon here", exact: true }).click();
  await expect(page).toHaveURL(/\/create/);
  await expect(page).toHaveURL(/placeLabel=Willow/);
  await expect(page).toHaveURL(/latitude=41.889/);
});
