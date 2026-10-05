import { expect, test } from "@playwright/test";

async function openPlanning(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("tab", { name: "Squads", exact: true }).click();
  await page
    .getByRole("button", {
      name: "See all responses and invitations",
      exact: true,
    })
    .click();
}

test("planning supports ping replies, conversion, and an approved vote option", async ({
  page,
}) => {
  await openPlanning(page);

  await page
    .getByRole("button", {
      name: /A Saturday trail loop\?, Reply to this ping/,
    })
    .click();
  await page
    .getByRole("checkbox", { name: "Auto-RSVP if this ping becomes a beacon" })
    .click();
  await page.getByRole("button", { name: "Interested", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Interested · update", exact: true }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Pings & Decisions", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start a ping, vote, or draw" })
    .click();
  await page
    .getByLabel("Question or decision", { exact: true })
    .fill("Trail after work?");
  await page
    .getByRole("button", { name: "Create ping or decision", exact: true })
    .click();
  await expect(
    page.getByText("IF CONVERTED TO A BEACON", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Create a beacon from this ping" })
    .click();
  await expect(page).toHaveURL(/\/activity\/[^/]+$/i);
  await expect(page.getByText(/Audience: friends/)).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page
    .getByRole("button", { name: "Pings & Decisions", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start a ping, vote, or draw" })
    .click();
  await page.getByRole("button", { name: "Vote", exact: true }).click();
  await page
    .getByLabel("Question or decision", { exact: true })
    .fill("Pick our next crew plan");
  await page
    .getByRole("button", { name: "Create ping or decision", exact: true })
    .click();
  await page.getByRole("button", { name: "Add option", exact: true }).click();
  await page
    .getByLabel("Search activity ideas", { exact: true })
    .fill("Birdwatching");
  await page
    .getByRole("button", {
      name: "Select Birdwatching, 90 minutes, Other",
      exact: true,
    })
    .click();
  await page
    .getByLabel("Option title", { exact: true })
    .fill("Birdwatching at the lake");
  await page
    .getByRole("button", { name: "Advanced details", exact: true })
    .click();
  await page
    .getByLabel("Description (optional)", { exact: true })
    .fill("Bring binoculars and meet by the water.");
  await page.getByRole("button", { name: "Fitness", exact: true }).click();
  const starts = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const ends = new Date(starts.getTime() + 90 * 60 * 1000);
  await page.getByLabel(/Option starts/).fill(starts.toISOString());
  await page.getByLabel(/Option ends/).fill(ends.toISOString());
  await page
    .getByLabel("Place name (optional)", { exact: true })
    .fill("Lakeshore trailhead");
  await page.getByLabel("Latitude (optional)", { exact: true }).fill("41.88");
  await page.getByLabel("Longitude (optional)", { exact: true }).fill("-87.63");
  await page.getByRole("button", { name: "Back to idea", exact: true }).click();
  await page
    .getByRole("button", { name: "Add selected option", exact: true })
    .click();
  await expect(
    page.getByText("Birdwatching at the lake", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Fitness ·/).first()).toBeVisible();
  await expect(page.getByText(/Lakeshore trailhead/).first()).toBeVisible();
  await page.getByRole("button", { name: "Add option", exact: true }).click();
  await page
    .getByRole("button", { name: "Quick add Study - 60 min", exact: true })
    .click();
  await expect(page.getByText("Study together", { exact: true })).toBeVisible();
  await expect(page.getByText(/Study ·/).first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Approve option", exact: true }),
  ).toHaveCount(2);
  await page
    .getByRole("button", { name: "Approve option", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Approve option", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Vote for this option", exact: true }),
  ).toHaveCount(2);
  await page
    .getByRole("button", { name: "Vote for this option", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Your vote · change vote", exact: true }),
  ).toBeVisible();
});
