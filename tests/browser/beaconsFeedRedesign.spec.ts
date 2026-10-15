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
  await expect(page.getByRole("heading", { name: "Your Activity", exact: true })).toBeVisible();
  await expect(page.getByRole("tablist", { name: "Beacon time period" })).toHaveCount(0);
  await page.getByRole("button", { name: "Browse", exact: true }).click();
  await expect(page.getByTestId("browse-beacons-screen")).toBeVisible();
  await expect(page.getByTestId("browse-beacons-now")).toBeVisible();
  await expect(page.getByTestId("browse-beacons-upcoming")).toBeVisible();
  await page.setViewportSize({ width: 320, height: 844 });
  await expect(page.getByTestId("browse-beacons-screen")).toBeVisible();
  await expect(page.getByTestId("browse-beacons-upcoming")).toBeVisible();
  expect(await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Back to Beacons", exact: true }).click();
  await page.getByText("Your Activity", { exact: true }).filter({ visible: true }).locator("..").getByRole("button", { name: "See all", exact: true }).click();
  await expect(page.getByTestId("your-activity-screen")).toBeVisible();
  await expect(page.getByTestId("your-activity-header")).toHaveText("Your Activity");
  await page.getByRole("button", { name: "Back to Beacons", exact: true }).click();
  await page.getByRole("button", { name: "Saved & Tools", exact: true }).click();
  const templates = page.getByRole("button", { name: /^My Templates · \d+$/ });
  await expect(templates).toBeVisible();
  await templates.click();
  await expect(page.getByRole("button", { name: "New template", exact: true })).toBeVisible();
});
test("status persists Busy, edits availability, and clears", async ({
  page,
}) => {
  await openFeed(page);
  const openStatus = page.getByRole("button", {
    name: /^(Edit your status|Share your status)$/,
  });
  await openStatus.click();
  await expect(
    page.getByText(
      "Share availability only. This will not RSVP you to a Beacon.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Busy", exact: true }).first().click();
  await page
    .getByRole("textbox", { name: "Status note", exact: true })
    .fill("Quiet reading time");
  await page.getByRole("button", { name: "Save status", exact: true }).click();
  await expect(
    page.getByText("Quiet reading time", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Busy", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit your status", exact: true })
    .click();
  await page.getByRole("button", { name: "Free", exact: true }).click();
  await page.getByRole("button", { name: "Save status", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "Available", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Share your status", exact: true }),
  ).toBeVisible();
});
