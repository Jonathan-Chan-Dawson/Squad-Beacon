import { expect, test } from "@playwright/test";

for (const appearance of ["light", "dark"] as const) {
  for (const width of [320, 430]) {
    test(`public Organization request/cancel stays private at ${width}px in ${appearance}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.addInitScript(
        (value) => localStorage.setItem("beacon.appearance", value),
        appearance,
      );
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("/space/space-park-care");
      await page.getByRole("button", { name: /Explore the demo/ }).click();
      const profile = page.getByTestId("community-public-profile");
      await expect(profile).toContainText("Park Care Crew");
      await profile
        .getByRole("button", {
          name: "Request to Join Organization Park Care Crew",
          exact: true,
        })
        .click();
      await expect(
        profile.getByRole("button", {
          name: "Cancel request Organization Park Care Crew",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", {
          name: "Organization settings",
          exact: true,
        }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Chat", exact: true }),
      ).toHaveCount(0);
      await profile
        .getByRole("button", {
          name: "Cancel request Organization Park Care Crew",
          exact: true,
        })
        .click();
      await expect(
        profile.getByRole("button", {
          name: "Request to Join Organization Park Care Crew",
          exact: true,
        }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/community-request-${appearance}-${width}.png`,
        fullPage: true,
      });
      expect(errors).toEqual([]);
    });
  }
}

test("a public Organization lists independently discoverable Squads", async ({
  page,
}) => {
  await page.goto("/space/space-lakefront-runs");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  const profile = page.getByTestId("community-public-profile");
  await expect(profile).toContainText("Lakefront Runs");
  await expect(profile).toContainText("Squads in this Organization");
  await expect(
    profile
      .getByRole("button", { name: /Open run club|Neighborhood Runners/i })
      .first(),
  ).toBeVisible();
});

test("Browse public RSVP grants activity access without joining its community", async ({
  page,
}) => {
  await page.goto("/browse-beacons");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  const filters = page.getByRole("dialog", { name: "Filters", exact: true });
  await filters.getByRole("button", { name: "More filters", exact: true }).click();
  await filters.getByRole("button", { name: "Public", exact: true }).click();
  await filters.getByRole("button", { name: /^Show \d+ Beacons$/ }).click();
  await page
    .getByRole("textbox", { name: "Search Beacons", exact: true })
    .fill("Food? A walk?");
  const preview = page
    .getByTestId("map-public-preview")
    .filter({ hasText: "Food? A walk?" });
  await expect(preview).toContainText(/approximate area/i);
  await preview.getByRole("button", { name: "Join", exact: true }).click();
  await expect(page).toHaveURL(/\/activity\/neighborhood-0/);
});
