import { expect, test, type Page } from "@playwright/test";

async function openFeed(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
}

test("home links to compact browsing and personal activity while utilities remain reachable", async ({
  page,
}) => {
  await openFeed(page);
  await expect(
    page.getByRole("heading", { name: "Your Activity", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("tablist", { name: "Beacon time period" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Explore all →", exact: true })
    .click();
  await expect(page.getByTestId("browse-beacons-screen")).toBeVisible();
  await expect(page.getByTestId("browse-beacons-now")).toBeVisible();
  await page.setViewportSize({ width: 320, height: 844 });
  await expect(page.getByTestId("browse-beacons-screen")).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        Math.max(
          document.documentElement.scrollWidth,
          document.body.scrollWidth,
        ) <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Back to Beacons", exact: true })
    .click();
  await page
    .getByText("Your Activity", { exact: true })
    .filter({ visible: true })
    .locator("..")
    .getByRole("button", { name: "My Activity →", exact: true })
    .click();
  await expect(page.getByTestId("your-activity-screen")).toBeVisible();
  await expect(page.getByTestId("your-activity-header")).toHaveText(
    "Your Activity",
  );
  await page
    .getByRole("button", { name: "Back to Beacons", exact: true })
    .click();
  await page
    .getByRole("button", { name: "My Collection", exact: true })
    .click();
  const templates = page.getByRole("button", {
    name: "My Templates",
    exact: true,
  });
  await expect(templates).toBeVisible();
  await templates.click();
  await expect(
    page.getByRole("button", { name: "New Template", exact: true }),
  ).toBeVisible();
});
test("status persists Busy, edits availability, and clears", async ({
  page,
}) => {
  await openFeed(page);
  const status = page.getByTestId("compact-own-status");
  const edit = () =>
    status
      .getByRole("button", { name: /Add a status note|Edit your status note/ })
      .click();
  await edit();
  let dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: "Busy", exact: true }).click();
  await dialog
    .getByLabel("Activity Note", { exact: true })
    .fill("Quiet reading time");
  await dialog.getByRole("button", { name: "1 Hour", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Save Status", exact: true })
    .click();
  await expect(status).toContainText("Quiet reading time");
  await expect(status).toContainText("Busy");
  await edit();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: "Available", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Save Status", exact: true })
    .click();
  await expect(status).toContainText("Available");
  await edit();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Clear Status", exact: true })
    .click();
  await expect(status).not.toContainText("Quiet reading time");
  await expect(status).toContainText("Scheduled");
});
