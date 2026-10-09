import { expect, test, type Page } from "@playwright/test";

async function openFeed(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
}

test("feed pages preserve selection after phone resize and Past utilities remain reachable", async ({
  page,
}) => {
  await openFeed(page);
  await page.getByRole("tab", { name: /^Upcoming, \d+ Beacons$/ }).click();
  await expect(page.getByText("This week", { exact: true })).toBeInViewport();
  await page.setViewportSize({ width: 375, height: 667 });
  await expect(page.getByText("This week", { exact: true })).toBeInViewport();
  await expect(page.getByRole("tab", { name: /^Upcoming,/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.getByRole("tab", { name: "Past", exact: true }).click();
  for (const title of [
    "Beacon Plans",
    "Favorites",
    "My templates",
    "Library",
  ]) {
    await expect(
      page.getByRole("button", { name: new RegExp(`^${title}, \\d+$`) }),
    ).toBeInViewport();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: /^My templates, \d+$/ }),
  ).toBeInViewport();
  await page.getByRole("button", { name: /^My templates, \d+$/ }).click();
  await expect(
    page.getByRole("button", { name: "New template", exact: true }),
  ).toBeVisible();
});

test("status persists Busy, edits availability, and clears", async ({
  page,
}) => {
  await openFeed(page);
  const openStatus = page.getByRole("button", {
    name: /^(Edit your status|Share what you are up to)$/,
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
    page.getByRole("button", { name: "Share what you are up to", exact: true }),
  ).toBeVisible();
});
