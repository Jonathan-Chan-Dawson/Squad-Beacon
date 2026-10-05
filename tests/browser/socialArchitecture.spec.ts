import { expect, test, type Page } from "@playwright/test";
import { openConversation } from "./chatHelpers";

async function communities(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("tab", { name: "Squads", exact: true }).click();
  await page.getByRole("button", { name: "Communities", exact: true }).click();
}

test("Space cards open a compact preview before the full profile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await communities(page);
  await page
    .getByRole("button", {
      name: "Preview Space Neighborhood Studio",
      exact: true,
    })
    .click();
  const preview = page.getByRole("dialog");
  await expect(
    preview.getByText("Neighborhood Studio", { exact: true }).last(),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/squads/);
  await expect(
    preview.getByRole("button", {
      name: "View full Space profile",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/social-space-preview-320.png" });
  await preview
    .getByRole("button", { name: "View full Space profile", exact: true })
    .click();
  await expect(page).toHaveURL(/\/space\/space-neighborhood-studio/);
  for (const name of ["Overview", "Squads", "Activity"]) {
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  }
  await page.getByRole("button", { name: "Activity", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Activity", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("Organization preview leads to Overview, Communities and Activity without admin clutter", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await communities(page);
  await page
    .getByRole("button", { name: /^Preview Lakefront / })
    .first()
    .click();
  const preview = page.getByRole("dialog");
  await expect(page).toHaveURL(/\/squads/);
  await expect(
    preview.getByRole("button", {
      name: "View full organization profile",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    preview.getByRole("button", {
      name: /Transfer ownership|Ban member|Delete organization/,
    }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "test-results/social-organization-preview-390.png",
  });
  await preview
    .getByRole("button", {
      name: "View full organization profile",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/\/organization\//);
  for (const name of ["Overview", "Communities", "Activity"]) {
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  }
  await page.getByRole("button", { name: "Communities", exact: true }).click();
  expect(errors).toEqual([]);
});

test("a growing Squad requires explicit member-copy confirmation and preserves its chat", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await communities(page);
  await page.getByRole("button", { name: "Chats", exact: true }).click();
  await openConversation(page, "Pickup Basketball");
  await page
    .getByLabel("Message", { exact: true })
    .fill("Keep this game-night conversation.");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page
      .getByText("Keep this game-night conversation.", { exact: true })
      .last(),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Open Squad profile for Pickup Basketball",
      exact: true,
    })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /View full Squad Profile/i })
    .click();
  await expect(
    page.getByText(/^35 members · Huge Squad/).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Organize as a Space", exact: true })
    .click();
  const sheet = page.getByRole("dialog");
  await sheet
    .getByRole("textbox", { name: "Space name", exact: true })
    .fill("Basketball home");
  await expect(
    sheet.getByRole("button", { name: "Create Space", exact: true }),
  ).toBeDisabled();
  await sheet
    .getByRole("checkbox", { name: "Confirm member copy", exact: true })
    .click();
  await expect(
    sheet.getByRole("checkbox", {
      name: "Rename the source Squad to General",
      exact: true,
    }),
  ).not.toBeChecked();
  await page.screenshot({
    path: "test-results/social-conversion-confirmation-320.png",
  });
  await sheet
    .getByRole("button", { name: "Create Space", exact: true })
    .click();
  await expect(page).toHaveURL(/\/space\//);
  await expect(
    page.getByText("Basketball home", { exact: true }).filter({ visible: true }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Message Pickup Basketball", exact: true })
    .click();
  await expect(page).toHaveURL(/\/squad-chat\/pickup-basketball/);
  await expect(
    page
      .getByText("Keep this game-night conversation.", { exact: true })
      .last(),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("grouping managed Squads creates a lightweight Space without copying their members", async ({
  page,
}) => {
  await communities(page);
  await page
    .getByRole("button", { name: "New conversation", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create Space", exact: true })
    .click();
  const sheet = page.getByRole("dialog");
  await sheet
    .getByRole("button", { name: "Group Squads", exact: true })
    .click();
  await sheet
    .getByRole("checkbox", {
      name: "Select Squad The training crew",
      exact: true,
    })
    .click();
  await sheet
    .getByRole("checkbox", {
      name: "Select Squad Pickup Basketball",
      exact: true,
    })
    .click();
  await sheet
    .getByRole("textbox", { name: "Space name", exact: true })
    .fill("Active weekends");
  await sheet
    .getByRole("button", { name: "Create Space", exact: true })
    .click();
  await expect(page).toHaveURL(/\/space\//);
  await expect(
    page.getByText(/\b1 member\b|\b1 person\b/).filter({ visible: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", {
      name: "Message The training crew",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Message Pickup Basketball",
      exact: true,
    }),
  ).toBeVisible();
});

test("public discovery joins a Space without enrolling the viewer in its Squad", async ({
  page,
}) => {
  await communities(page);
  await expect(page.getByText("Discover", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Preview Space Lakefront Runs", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Join now", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Preview Squad Open Run Club", exact: true })
    .click();
  const preview = page.getByRole("dialog");
  await expect(
    preview.getByRole("button", { name: "Join now", exact: true }),
  ).toBeVisible();
  await expect(
    preview.getByText("In Lakefront Runs", { exact: true }),
  ).toBeVisible();
  await expect(
    preview.getByRole("button", {
      name: "Open community profile",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.screenshot({ path: "test-results/social-public-summary-390.png" });
});

test("request-to-join communities offer a cancellable request, not automatic membership", async ({
  page,
}) => {
  await communities(page);
  await expect(page.getByText("Discover", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Preview Space Park Care Crew", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Request to join", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Search conversations", exact: true })
    .click();
  await page
    .getByRole("textbox", {
      name: "Search people, Beacons, Squads and communities",
      exact: true,
    })
    .fill("Park Care Crew");
  await page
    .getByRole("button", { name: "Preview Space Park Care Crew", exact: true })
    .click();
  const preview = page.getByRole("dialog");
  await expect(
    preview.getByRole("button", { name: "Cancel join request", exact: true }),
  ).toBeVisible();
  await expect(
    preview.getByRole("button", { name: "Join now", exact: true }),
  ).toHaveCount(0);
  await preview
    .getByRole("button", { name: "Cancel join request", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Preview Space Park Care Crew", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Request to join", exact: true }),
  ).toBeVisible();
});

test("related community previews and their Beacons stay in one sheet with a working Back path", async ({ page }) => {
  await communities(page);
  await page.getByRole("button", { name: "Preview Space Neighborhood Studio", exact: true }).click();
  const preview = page.getByRole("dialog");
  await preview.getByRole("button", { name: "Preview Organization Lakefront Collective", exact: true }).click();
  await expect(page).toHaveURL(/\/squads/);
  await preview.getByRole("button", { name: "Preview Beacon Lakefront trail loop", exact: true }).click();
  await expect(preview.getByText("Lakefront trail loop", { exact: true }).filter({ visible: true })).toBeVisible();
  await preview.getByRole("button", { name: /Back to (preview|Space)/i }).click();
  await expect(preview.getByRole("button", { name: "View full organization profile", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await preview.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Preview Space Neighborhood Studio", exact: true }).click();
  await expect(preview.getByRole("button", { name: "View full Space profile", exact: true })).toBeVisible();
});

test("Profile opens the existing friend and private-list manager without adding community tabs", async ({ page }) => {
  await communities(page);
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "Open Friends & Lists", exact: true }).click();
  const manager = page.getByRole("dialog");
  await expect(manager.getByRole("button", { name: "Private lists", exact: true })).toBeVisible();
  await manager.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Communities", exact: true }).click();
  await expect(page.getByRole("button", { name: "Private lists", exact: true })).toHaveCount(0);
});

test("a Space seeds optional Beacon association without introducing a Space audience", async ({ page }) => {
  await communities(page);
  await page.getByRole("button", { name: "Preview Space Neighborhood Studio", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "View full Space profile", exact: true }).click();
  await page.getByRole("button", { name: "Activity", exact: true }).click();
  await page.getByRole("button", { name: "+ Beacon", exact: true }).click();
  await expect(page).toHaveURL(/\/create\?spaceId=space-neighborhood-studio/);
  await expect(page.getByRole("button", { name: "Associated with Neighborhood Studio", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "space", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Associated with Neighborhood Studio", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "No community association", exact: true }).click();
  await expect(page.getByRole("button", { name: "Choose a community", exact: true })).toBeVisible();
});
