import { expect, test, type Locator } from "@playwright/test";
import { mockOnboardingAccount } from "./onboardingAccount";
import { startDemoFromEntry } from "./demoEntry";

for (const width of [320, 390, 1024]) {
  for (const appearance of ["light", "dark"] as const) {
    test(`release cards and key journeys at ${width}px in ${appearance}`, async ({ page }, info) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.addInitScript((mode) => localStorage.setItem("beacon.appearance", mode), appearance);
      await mockOnboardingAccount(page, { signedOut: true });
      await page.route(/.*(?:cartocdn\.com|basemaps\.carto\.com).*/, (route) => route.abort());
      await page.goto("/auth/sign-in");
      await startDemoFromEntry(page);

      async function capture(name: string, region: Locator) {
        await expect(region).toBeVisible();
        const { x, width: regionWidth } = (await region.boundingBox())!;
        expect(x).toBeGreaterThanOrEqual(-1);
        expect(x + regionWidth).toBeLessThanOrEqual(width + 1);
        await region.screenshot({ path: info.outputPath(`${name}.png`) });
      }

      const mapSearch = page.getByRole("textbox", { name: "Search places, Beacons, people and communities" });
      await mapSearch.fill("Plan stop 1: Coffee together");
      await page.getByTestId("map-search-results")
        .getByRole("button", { name: "Open Plan stop 1: Coffee together Beacon" })
        .click();
      const mapCard = page.getByTestId("map-tooltip-card");
      await expect(mapCard.getByRole("button", { name: /^Beacon tools/ })).toBeVisible();
      await capture("map-beacon", mapCard);
      await page.screenshot({ path: info.outputPath("map-selection.png") });
      await mapCard.getByRole("button", { name: "Close map preview" }).click();

      await page.getByRole("tab", { name: "Beacons", exact: true }).click();
      await capture("your-people", page.getByTestId("friends-right-now"));
      await page.getByRole("button", { name: "Explore all →", exact: true }).click();
      await page.getByTestId("browse-beacons-search").fill("coffee together");
      const browse = page.getByTestId("browse-beacons-screen");
      await expect(browse.getByRole("button", { name: /^Filters/ })).toBeVisible();
      await capture("browse-beacon", browse.getByTestId("discovery-beacon-card-map-plan-coffee"));
      await page.getByRole("button", { name: "Back to Beacons", exact: true }).click();

      await page.getByRole("tab", { name: "Profile", exact: true }).click();
      await expect(page.getByTestId("profile-identity")).toBeVisible();
      await page.screenshot({ path: info.outputPath("profile.png") });
      await page.getByRole("button", { name: "Create", exact: true }).click();
      await page.getByRole("button", { name: "+ Create Blank Beacon", exact: true }).click();
      const timing = page.getByTestId("inline-beacon-timing");
      const later = timing.getByLabel("Start time: In 30 min", { exact: true });
      await later.click();
      await expect(later).toHaveAttribute("aria-selected", "true");
      await capture("creation-timing", timing);
    });
  }
}
