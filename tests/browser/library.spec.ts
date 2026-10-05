import { expect, test } from "@playwright/test";

test("shared beacon library files one card privately without duplicating content", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
  await page.getByRole("button", { name: "Past", exact: true }).click();
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await expect(page.getByText("Your library", { exact: true })).toBeVisible();
  const card = page.getByTestId("library-card-demo-tools");
  await expect(card).toBeVisible();
  await expect(
    card.getByText("1 entry · Unfiled", { exact: true }),
  ).toBeVisible();

  await page.getByLabel("Folder name", { exact: true }).fill("Weekend walks");
  await page
    .getByRole("button", { name: "Create folder", exact: true })
    .click();
  await page.getByRole("button", { name: "All", exact: true }).click();
  await card.getByRole("button", { name: "File", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Move Beacon reference to Weekend walks",
      exact: true,
    })
    .click();
  await expect(
    card.getByText("1 entry · Weekend walks", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Weekend walks", exact: true })
    .click();
  await expect(card).toBeVisible();

  await page.getByRole("tab", { name: "Lists", exact: true }).click();
  const checklistCard = page.getByTestId("library-card-demo-tools");
  await expect(
    checklistCard.getByText("2 items · Unfiled", { exact: true }),
  ).toBeVisible();
  await expect(checklistCard).toHaveCount(1);
});

test("private Journals and saved Lists have dedicated editors and list handoff", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
  await page.getByRole("button", { name: "Past", exact: true }).click();
  await page.getByRole("button", { name: "Library", exact: true }).click();

  await page.getByRole("button", { name: "New entry", exact: true }).click();
  await page.getByLabel("Heading (optional)").fill("Trail thought");
  await page
    .getByRole("textbox", { name: "Journal entry", exact: true })
    .fill("A private note from the library.");
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
  await expect(
    page.getByText("A private note from the library.", { exact: true }),
  ).toBeVisible();

  await page.getByRole("tab", { name: "Lists", exact: true }).click();
  await page.getByRole("button", { name: "New list", exact: true }).click();
  await page.getByLabel("List name").fill("Quick hike kit");
  await page.getByLabel("Sections (one per line)").fill("Pack");
  await page
    .getByLabel("Items (one per line; optional Section :: item)")
    .fill("Pack :: Water bottle");
  await page.getByRole("button", { name: "Save list", exact: true }).click();
  const savedList = page
    .locator('[data-testid^="saved-checklist-"]')
    .filter({ hasText: "Quick hike kit" });
  await expect(savedList).toBeVisible();
  await expect(savedList.getByText(/Water bottle/)).toBeVisible();
  await savedList
    .getByRole("button", { name: "Use for a new Beacon", exact: true })
    .click();
  await expect(page).toHaveURL(/\/create\?.*savedChecklist=/);
});
