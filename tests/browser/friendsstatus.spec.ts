import { expect, test, type Page } from "@playwright/test";

async function enterDemo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
}

test("Friends Now shows accessible live status, timing, and only viewable locations", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-03T12:00:00Z") });
  await enterDemo(page);
  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
  await page.screenshot({ path: "test-results/friendsstatus-friends.png" });

  const availableBadge = page.getByTestId("availability-badge-sam");
  await expect(availableBadge).toHaveAttribute(
    "aria-label",
    "Availability: Available",
  );
  await expect(page.getByLabel(/^Time: Available until/).first()).toBeVisible();
  await expect(page.getByLabel("Location shared").first()).toBeVisible();
  await page.getByRole("button", { name: "See more", exact: true }).click();
  await expect(
    page.getByTestId("availability-badge-neighbor-1"),
  ).toHaveAttribute("aria-label", "Availability: Unavailable");

  await page.clock.fastForward(60 * 60 * 1000);
  await expect(availableBadge.first()).toHaveAttribute(
    "aria-label",
    "Availability: Ending soon",
  );
  await page.screenshot({ path: "test-results/friendsstatus-endingsoon.png" });
});

test("single-choice navigation omits checks while multi-select keeps its check icon", async ({
  page,
}) => {
  await enterDemo(page);
  await page.getByRole("tab", { name: "Beacons", exact: true }).click();
  await expect(page.getByText("✓ Current", { exact: true })).toHaveCount(0);
  await expect(page.getByText("✓ Everyone", { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Starred Friends", exact: true })
    .click();
  await expect(
    page.getByText("✓ Starred Friends", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Free to hang", exact: true }).click();
  await expect(page.getByText("✓ Free to hang", { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Upcoming", exact: true }).click();
  await expect(page.getByText("✓ Upcoming", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Past", exact: true }).click();
  await expect(page.getByText("✓ Past", { exact: true })).toHaveCount(0);

  await page.getByRole("tab", { name: "Squads", exact: true }).click();
  await page.getByRole("button", { name: "Search conversations", exact: true }).click();
  await page.getByRole("button", { name: "Friends", exact: true }).click();
  await expect(page.getByText("✓ Friends", { exact: true })).toHaveCount(0);

  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "Retake profile survey" }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Search interests").fill("Day hiking");
  await page
    .getByRole("button", { name: "Choose Day hiking", exact: true })
    .click();
  const selectedInterest = page.getByRole("button", {
    name: "Remove Day hiking",
    exact: true,
  });
  await expect(selectedInterest.first()).toBeVisible();
  await expect(selectedInterest.first().locator("svg")).toHaveCount(1);
});
