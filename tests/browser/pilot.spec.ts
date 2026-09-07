import { test, expect } from "@playwright/test";
test("demo supports RSVP, goals, habits, squads, and creation without a backend", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Explore the demo →" }).click();
  await expect(page.getByText("Find your next together.")).toBeVisible();
  await page
    .getByRole("button", { name: "View A few rounds. Good company." })
    .click();
  await page.getByRole("button", { name: "Squad in · Interested" }).click();
  await expect(page.getByText("Your RSVP: interested")).toBeVisible();
  await page.getByRole("button", { name: "I’m going", exact: true }).click();
  await expect(page.getByText("Your RSVP: going")).toBeVisible();
  await page.getByLabel("Add a comment").fill("See you there!");
  await page.getByRole("button", { name: "Post comment" }).click();
  await expect(page.getByText("See you there!", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "← Activities" }).click();
  await page.getByRole("tab", { name: "Progress" }).click();
  await page.getByRole("button", { name: "+ Goal", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Finish my first 10K");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit goal Finish my first 10K" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Check in for today" })
    .first()
    .click();
  await expect(page.getByText("You showed up today.")).toBeVisible();
  await page.getByRole("tab", { name: "Squads" }).click();
  await page.getByRole("button", { name: "Friends", exact: true }).click();
  await expect(page.getByLabel("Invitation QR code for @alex")).toBeVisible();
  await page.getByRole("button", { name: "Squads", exact: true }).click();
  await page.getByRole("button", { name: "+ Create a squad" }).click();
  await page.getByLabel("Name", { exact: true }).fill("The study crew");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Open squad The study crew" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Create activity", exact: true })
    .click();
  await page.getByLabel("What are you doing?").fill("A focused afternoon");
  await page.getByRole("button", { name: "Create activity →" }).click();
  await expect(
    page.getByRole("button", { name: "View A focused afternoon" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Profile" }).click();
  await expect(
    page.getByText("A work in progress.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Activities" }).click();
  expect(errors).toEqual([]);
  await page.screenshot({
    path: "test-results/activities-mobile.png",
    fullPage: true,
  });
});
test("demo location never starts device tracking and validation errors stay in the form", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore the demo →" }).click();
  await page.getByText("Your live location is off", { exact: true }).click();
  await page.getByRole("button", { name: "Start temporary sharing" }).click();
  await expect(
    page.getByText("The demo never shares your device location.", {
      exact: false,
    }),
  ).toBeVisible();
});
